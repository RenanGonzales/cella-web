import { createTheme } from '@mui/material/styles';

/**
 * Cella palette: navy brand on light surfaces, blue tints for depth.
 * Every color in the app comes from here, so the look can change in one file.
 */
export const palette = {
  navy: '#0B2545',
  navyMid: '#134074',
  steel: '#8DA9C4',
  ice: '#C9D9EA',
  frost: '#DDE7F0',
  canvas: '#EEF0F4',
  surface: '#FFFFFF',
  track: '#E4E7ED',
  text: '#0B2545',
  textSoft: '#3E4658',
  textMuted: '#5E6678',
  textFaint: '#8A92A3',
} as const;

/** Soft blue glow used on the one highlighted card of a screen. */
export const glow = [
  'radial-gradient(circle at 8% 0%, rgba(141,169,196,0.55), transparent 52%)',
  'radial-gradient(circle at 100% 100%, rgba(201,217,234,0.85), transparent 55%)',
  'radial-gradient(circle at 60% 10%, rgba(221,231,240,0.9), transparent 45%)',
].join(', ');

export const fonts = {
  ui: "'Geist', system-ui, sans-serif",
  logo: "'Dancing Script', cursive",
};

export const theme = createTheme({
  palette: {
    primary: { main: palette.navy, contrastText: '#FFFFFF' },
    secondary: { main: palette.steel },
    background: { default: palette.canvas, paper: palette.surface },
    text: { primary: palette.text, secondary: palette.textMuted },
    divider: palette.canvas,
  },
  shape: { borderRadius: 30 },
  typography: {
    fontFamily: fonts.ui,
    h1: { fontSize: 34, fontWeight: 500, letterSpacing: '-0.03em' },
    h2: { fontSize: 15, fontWeight: 500 },
    body1: { fontSize: 15 },
    body2: { fontSize: 13 },
    button: { textTransform: 'none', fontWeight: 500, fontSize: 15 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 999, minHeight: 44, paddingInline: 20 },
        sizeLarge: { minHeight: 56, fontSize: 16 },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { borderRadius: 30 } },
    },
    MuiTextField: { defaultProps: { fullWidth: true } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 18, backgroundColor: palette.surface },
        notchedOutline: { borderColor: palette.track },
      },
    },
    MuiSnackbarContent: {
      styleOverrides: {
        root: { borderRadius: 999, backgroundColor: palette.navy, paddingInline: 18 },
      },
    },
  },
});
