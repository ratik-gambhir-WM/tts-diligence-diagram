type LayeredArchColorSchema = {
  background: {
    page: string;
    canvas: string;
    section: string;
  };
  boxes: {
    primary: {
      fill: string;
      text: string;
      border: string;
    };
    secondary_data_shapes: {
      fill: string;
      text: string;
      border: string;
    };
  };
  text: {
    dark: string;
    light: string;
    muted: string;
  };
  accents: {
    red: string;
    blue: string;
  };
  lines: {
    connectors: string;
    dividers: string;
  };
};

export const colorSchema: LayeredArchColorSchema = {
  background: {
    page: "#FFFFFF",
    canvas: "#F4F6FB",
    section: "#D0D7E5"
  },
  boxes: {
    primary: {
      fill: "#060150",
      text: "#FFFFFF",
      border: "#060150"
    },
    secondary_data_shapes: {
      fill: "#C9CFDA",
      text: "#060150",
      border: "#060150"
    }
  },
  text: {
    dark: "#060150",
    light: "#FFFFFF",
    muted: "#4E5766"
  },
  accents: {
    red: "#E53935",
    blue: "#060150"
  },
  lines: {
    connectors: "#C7D0E0",
    dividers: "#C7D0E0"
  }
};