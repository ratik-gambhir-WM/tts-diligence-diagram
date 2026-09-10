import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import type { PowerPointCanvasJson } from '../lib/import/PowerpointImportTypes'
import type {
  StoredTemplate,
  StoredTemplateMetadata,
  StoredTemplatePreview,
  StoredTemplateSummary,
  StoredTemplateWithAssets,
  TemplateAsset,
  TemplateInsert,
  TemplateKind,
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

type TemplatePreviewRow = {
  content_type: 'image/png'
  height: number
  preview_data: Uint8Array
  template_id: string
  width: number
}

type TemplateSummaryRow = TemplateRow & {
  checksum: string | null
  created_at: string
  description: string
  kind: TemplateKind
  preview_available: number
  source: 'builtin' | 'import'
}

const SCHEMA_VERSION = 2

export class SqliteTemplateRepository implements TemplateRepository {
  readonly #database: DatabaseSync

  constructor(databasePath: string) {
    if (databasePath !== ':memory:') {
      mkdirSync(path.dirname(databasePath), { recursive: true })
    }

    this.#database = new DatabaseSync(databasePath)
    this.#database.exec('PRAGMA foreign_keys = ON')
    this.#database.exec('PRAGMA journal_mode = WAL')
    this.#migrate()
  }

  #migrate() {
    const version = this.#database.prepare('PRAGMA user_version').get() as { user_version: number }
    if (version.user_version > SCHEMA_VERSION) {
      throw new Error('The template database schema is newer than this server supports.')
    }

    this.#database.exec('BEGIN IMMEDIATE')
    try {
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

      if (version.user_version < 2) {
        this.#database.exec(`
          CREATE TABLE IF NOT EXISTS template_metadata (
            template_id TEXT PRIMARY KEY,
            kind TEXT NOT NULL CHECK (kind IN ('diagram', 'commentary')),
            description TEXT NOT NULL,
            source TEXT NOT NULL CHECK (source IN ('builtin', 'import')),
            checksum TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (template_id) REFERENCES templates(template_id) ON DELETE CASCADE
          ) STRICT;

          CREATE TABLE IF NOT EXISTS template_previews (
            template_id TEXT PRIMARY KEY,
            content_type TEXT NOT NULL CHECK (content_type = 'image/png'),
            preview_data BLOB NOT NULL CHECK (length(preview_data) > 0),
            width INTEGER NOT NULL CHECK (width > 0),
            height INTEGER NOT NULL CHECK (height > 0),
            FOREIGN KEY (template_id) REFERENCES templates(template_id) ON DELETE CASCADE
          ) STRICT;

          INSERT OR IGNORE INTO template_metadata (
            template_id, kind, description, source, checksum, created_at
          )
          SELECT template_id, 'diagram', '', 'import', NULL, CURRENT_TIMESTAMP
          FROM templates;
        `)
      }

      this.#database.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`)
      this.#database.exec('COMMIT')
    } catch (error) {
      this.#database.exec('ROLLBACK')
      throw error
    }
  }

  insert(
    template: StoredTemplate,
    assets: readonly TemplateAsset[],
    metadata: StoredTemplateMetadata = defaultMetadata(template.templateId),
    preview?: StoredTemplatePreview,
  ) {
    this.insertMany([{ assets, metadata, preview, template }])
  }

  insertMany(records: readonly TemplateInsert[]) {
    this.#database.exec('BEGIN IMMEDIATE')
    try {
      for (const record of records) {
        this.#writeTemplateAndAssets(
          'insert',
          record.template,
          record.assets,
          record.metadata ?? defaultMetadata(record.template.templateId),
          record.preview,
        )
      }
      this.#database.exec('COMMIT')
    } catch (error) {
      this.#database.exec('ROLLBACK')
      throw error
    }
  }

  update(template: StoredTemplate, assets: readonly TemplateAsset[]) {
    this.#database.exec('BEGIN IMMEDIATE')
    try {
      this.#writeTemplateAndAssets('update', template, assets)
      this.#database.exec('COMMIT')
    } catch (error) {
      this.#database.exec('ROLLBACK')
      throw error
    }
  }

  #writeTemplateAndAssets(
    operation: 'insert' | 'update',
    template: StoredTemplate,
    assets: readonly TemplateAsset[],
    metadata?: StoredTemplateMetadata,
    preview?: StoredTemplatePreview,
  ) {
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

    if (metadata) {
      assertTemplateOwnership(template.templateId, metadata.templateId)
      this.#database.prepare(`
          INSERT INTO template_metadata (
            template_id, kind, description, source, checksum, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(template_id) DO UPDATE SET
            kind = excluded.kind,
            description = excluded.description,
            source = excluded.source,
            checksum = excluded.checksum,
            created_at = excluded.created_at
      `).run(
        metadata.templateId,
        metadata.kind,
        metadata.description,
        metadata.source,
        metadata.checksum,
        metadata.createdAt,
      )
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

    if (preview) {
      assertTemplateOwnership(template.templateId, preview.templateId)
      this.#database.prepare(`
          INSERT INTO template_previews (
            template_id, content_type, preview_data, width, height
          ) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(template_id) DO UPDATE SET
            content_type = excluded.content_type,
            preview_data = excluded.preview_data,
            width = excluded.width,
            height = excluded.height
      `).run(
        preview.templateId,
        preview.contentType,
        preview.bytes,
        preview.width,
        preview.height,
      )
    }
  }

  upsertBuiltin(
    template: StoredTemplate,
    assets: readonly TemplateAsset[],
    metadata: StoredTemplateMetadata,
    preview: StoredTemplatePreview,
  ) {
    assertTemplateOwnership(template.templateId, metadata.templateId)
    assertTemplateOwnership(template.templateId, preview.templateId)
    const existing = this.#database.prepare(`
      SELECT source, checksum FROM template_metadata WHERE template_id = ?
    `).get(template.templateId) as { checksum: string | null; source: string } | undefined

    if (existing?.source === 'import' || existing?.checksum === metadata.checksum) {
      return
    }

    this.#database.exec('BEGIN IMMEDIATE')
    try {
      this.#database.prepare(`
        INSERT INTO templates (template_id, template_json) VALUES (?, json(?))
        ON CONFLICT(template_id) DO UPDATE SET template_json = excluded.template_json
      `).run(template.templateId, JSON.stringify(template.templateJson))
      this.#database.prepare('DELETE FROM template_assets WHERE template_id = ?').run(template.templateId)
      this.#database.prepare('DELETE FROM template_previews WHERE template_id = ?').run(template.templateId)

      const insertAsset = this.#database.prepare(`
        INSERT INTO template_assets (asset_id, template_id, content_type, asset_data)
        VALUES (?, ?, ?, ?)
      `)
      for (const asset of assets) {
        assertTemplateOwnership(template.templateId, asset.templateId)
        insertAsset.run(asset.assetId, asset.templateId, asset.contentType, asset.bytes)
      }

      this.#database.prepare(`
        INSERT INTO template_metadata (
          template_id, kind, description, source, checksum, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(template_id) DO UPDATE SET
          kind = excluded.kind,
          description = excluded.description,
          source = excluded.source,
          checksum = excluded.checksum,
          created_at = excluded.created_at
      `).run(
        metadata.templateId,
        metadata.kind,
        metadata.description,
        metadata.source,
        metadata.checksum,
        metadata.createdAt,
      )
      this.#database.prepare(`
        INSERT INTO template_previews (
          template_id, content_type, preview_data, width, height
        ) VALUES (?, ?, ?, ?, ?)
      `).run(
        preview.templateId,
        preview.contentType,
        preview.bytes,
        preview.width,
        preview.height,
      )
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

  list(kind?: TemplateKind): StoredTemplateSummary[] {
    const rows = this.#database
      .prepare(`
        SELECT
          templates.template_id,
          templates.template_json,
          template_metadata.kind,
          template_metadata.description,
          template_metadata.source,
          template_metadata.checksum,
          template_metadata.created_at,
          CASE WHEN template_previews.template_id IS NULL THEN 0 ELSE 1 END AS preview_available
        FROM templates
        JOIN template_metadata ON template_metadata.template_id = templates.template_id
        LEFT JOIN template_previews ON template_previews.template_id = templates.template_id
        WHERE (? IS NULL OR template_metadata.kind = ?)
        ORDER BY template_metadata.created_at DESC, templates.rowid DESC
      `)
      .all(kind ?? null, kind ?? null) as TemplateSummaryRow[]

    return rows.map((row) => ({
      templateId: row.template_id,
      templateJson: JSON.parse(row.template_json) as PowerPointCanvasJson,
      metadata: {
        checksum: row.checksum,
        createdAt: row.created_at,
        description: row.description,
        kind: row.kind,
        source: row.source,
        templateId: row.template_id,
      },
      previewAvailable: row.preview_available === 1,
    }))
  }

  findPreview(templateId: string) {
    const row = this.#database.prepare(`
      SELECT template_id, content_type, preview_data, width, height
      FROM template_previews
      WHERE template_id = ?
    `).get(templateId) as TemplatePreviewRow | undefined

    return row
      ? {
          bytes: Buffer.from(row.preview_data),
          contentType: row.content_type,
          height: row.height,
          templateId: row.template_id,
          width: row.width,
        }
      : undefined
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

function defaultMetadata(templateId: string): StoredTemplateMetadata {
  return {
    checksum: null,
    createdAt: new Date().toISOString(),
    description: 'Imported PowerPoint template',
    kind: 'diagram',
    source: 'import',
    templateId,
  }
}

function assertTemplateOwnership(templateId: string, ownedTemplateId: string) {
  if (templateId !== ownedTemplateId) {
    throw new Error('Template data cannot be stored under a different template.')
  }
}
