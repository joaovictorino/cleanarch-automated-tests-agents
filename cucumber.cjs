// Modelo de referência: o aluno cria e explica seu próprio cucumber.cjs na raiz.
// Válido para projeto CommonJS; adaptação necessária para package.json type=module.
module.exports = {
  default: {
    paths: ['features/**/*.feature'],
    requireModule: ['tsx/cjs'],
    require: [
      'features/support/**/*.ts',
      'features/step-definitions/**/*.ts',
    ],
    format: [
      'progress',
      ['html', 'reports/cucumber.html'],
      ['json', 'reports/cucumber.json'],
    ],
    publish: false,
    parallel: 0,
  },
};
