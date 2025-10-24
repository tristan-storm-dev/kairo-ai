module.exports = {
  presets: ['@babel/preset-typescript'],
  plugins: [
    [
      'module:react-native-dotenv',
      {
        moduleName: '@env',
        path: './.env',
        allowUndefined: true,
      }
    ]
  ]
};
