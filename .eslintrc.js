module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // Styles are mostly data-driven (active states, computed widths), so inline styles are intentional.
    'react-native/no-inline-styles': 'off',
  },
};
