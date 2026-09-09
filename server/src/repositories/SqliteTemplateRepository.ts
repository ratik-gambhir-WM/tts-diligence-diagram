import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import type { PowerPointCanvasJson } from '../lib/import/PowerpointImportTypes'
import type {
  StoredTemplate,
  StoredTemplateWithAssets,
  TemplateAsset,
  TemplateRepository,
} from './TemplateRepository'

type TemplateRow = {
  template_id: string
  template_json: string
}

type TemplateAssetRow = {
  asset_data: Uint8Array
  asset_id: string
  content_type: string
  template_id: string
}

type TemplateWithAssetRow = TemplateRow & {
  asset_data: Uint8Array | null
  asset_id: string | null
  content_type: string | null
  asset_template_id: string | null
}

export class SqliteTemplateRepository implements TemplateRepository {
  readonly #database: DatabaseSync

  constructor(databasePath: string) {
    if (databasePath !== ':memory:') {
      mkdirSync(path.dirname(databasePath), { recursive: true })
    }

    this.#database = new DatabaseSync(databasePath)
    this.#database.exec('PRAGMA foreign_keys = ON')
    this.#database.exec('PRAGMA journal_mode = WAL')
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS templates (
        template_id TEXT PRIMARY KEY,
        template_json TEXT NOT NULL CHECK (json_valid(template_json))
      ) STRICT;

      CREATE TABLE IF NOT EXISTS template_assets (
        asset_id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL,
        content_type TEXT NOT NULL CHECK (content_type LIKE 'image/%'),
        asset_data BLOB NOT NULL CHECK (length(asset_data) > 0),
        FOREIGN KEY (template_id) REFERENCES templates(template_id) ON DELETE CASCADE
      ) STRICT;

      CREATE INDEX IF NOT EXISTS template_assets_template_id_idx
        ON template_assets (template_id);
    `)
  }

  insert(template: StoredTemplate, assets: readonly TemplateAsset[]) {
    this.#writeTemplateAndAssets('insert', template, assets)
  }

  update(template: StoredTemplate, assets: readonly TemplateAsset[]) {
    this.#writeTemplateAndAssets('update', template, assets)
  }

  #writeTemplateAndAssets(
    operation: 'insert' | 'update',
    template: StoredTemplate,
    assets: readonly TemplateAsset[],
  ) {
    this.#database.exec('BEGIN IMMEDIATE')
    try {
      const serializedTemplate = JSON.stringify(template.templateJson)
      if (operation === 'insert') {
        this.#database
          .prepare('INSERT INTO templates (template_id, template_json) VALUES (?, json(?))')
          .run(template.templateId, serializedTemplate)
      } else {
        this.#database
          .prepare('UPDATE templates SET template_json = json(?) WHERE template_id = ?')
          .run(serializedTemplate, template.templateId)
      }

      const insertAsset = this.#database.prepare(`
        INSERT INTO template_assets (asset_id, template_id, content_type, asset_data)
        VALUES (?, ?, ?, ?)
      `)
      for (const asset of assets) {
        if (asset.templateId !== template.templateId) {
          throw new Error('A template asset cannot be stored under a different template.')
        }
        insertAsset.run(asset.assetId, asset.templateId, asset.contentType, asset.bytes)
      }
      this.#database.exec('COMMIT')
    } catch (error) {
      this.#database.exec('ROLLBACK')
      throw error
    }
  }

  findAsset(templateId: string, assetId: string) {
    const row = this.#database
      .prepare(`
        SELECT asset_id, template_id, content_type, asset_data
        FROM template_assets
        WHERE template_id = ? AND asset_id = ?
      `)
      .get(templateId, assetId) as TemplateAssetRow | undefined

    if (!row) {
      return undefined
    }

    return {
      assetId: row.asset_id,
      bytes: Buffer.from(row.asset_data),
      contentType: row.content_type,
      templateId: row.template_id,
    }
  }

  findById(templateId: string) {
    const row = this.#database
      .prepare('SELECT template_id, template_json FROM templates WHERE template_id = ?')
      .get(templateId) as TemplateRow | undefined

    if (!row) {
      return undefined
    }

    return {
      templateId: row.template_id,
      templateJson: JSON.parse(row.template_json) as PowerPointCanvasJson,
    }
  }

  list() {
    const rows = this.#database
      .prepare('SELECT template_id, template_json FROM templates ORDER BY rowid DESC')
      .all() as TemplateRow[]

    return rows.map((row) => ({
      templateId: row.template_id,
      templateJson: JSON.parse(row.template_json) as PowerPointCanvasJson,
    }))
  }

  delete(templateId: string) {
    const result = this.#database
      .prepare('DELETE FROM templates WHERE template_id = ?')
      .run(templateId)
    return result.changes > 0
  }

  findByIdWithAssets(templateId: string): StoredTemplateWithAssets | undefined {
    const rows = this.#database
      .prepare(`
        SELECT
          templates.template_id,
          templates.template_json,
          template_assets.asset_id,
          template_assets.template_id AS asset_template_id,
          template_assets.content_type,
          template_assets.asset_data
        FROM templates
        LEFT JOIN template_assets
          ON template_assets.template_id = templates.template_id
        WHERE templates.template_id = ?
        ORDER BY template_assets.asset_id
      `)
      .all(templateId) as TemplateWithAssetRow[]

    const templateRow = rows[0]
    if (!templateRow) {
      return undefined
    }

    const assets: TemplateAsset[] = []
    for (const row of rows) {
      if (
        row.asset_id === null
        || row.asset_template_id === null
        || row.content_type === null
        || row.asset_data === null
      ) {
        continue
      }
      assets.push({
        assetId: row.asset_id,
        bytes: Buffer.from(row.asset_data),
        contentType: row.content_type,
        templateId: row.asset_template_id,
      })
    }

    return {
      assets,
      templateId: templateRow.template_id,
      templateJson: JSON.parse(templateRow.template_json) as PowerPointCanvasJson,
    }
  }

  close() {
    this.#database.close()
  }
}
