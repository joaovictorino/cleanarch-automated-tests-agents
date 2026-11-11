import { ambienteSemAzure, validarAzure, VARIAVEIS_AZURE } from '../../avaliacao/ambiente';

const completo = {
  AZURE_OPENAI_BASE_URL: 'https://recurso.openai.azure.com/openai/v1/',
  AZURE_OPENAI_API_KEY: 'chave-sintetica-123',
  AZURE_OPENAI_DEPLOYMENT: 'dep',
};

describe('validarAzure (npm run eval nunca cai para o fake)', () => {
  test('configuração completa e válida não tem problema', () => {
    expect(validarAzure(completo)).toBeNull();
  });

  test.each(VARIAVEIS_AZURE)('sem %s falha citando só o nome', (nome) => {
    const env = { ...completo, [nome]: '' };
    const mensagem = validarAzure(env);
    expect(mensagem).toContain(nome);
    for (const valor of Object.values(completo)) expect(mensagem).not.toContain(valor);
  });

  test('base inválida falha sem imprimir a chave', () => {
    const mensagem = validarAzure({ ...completo, AZURE_OPENAI_BASE_URL: 'http://inseguro/openai/v1/' });
    expect(mensagem).toEqual(expect.any(String));
    expect(mensagem).not.toContain('chave-sintetica-123');
  });
});

describe('ambienteSemAzure (isolamento do offline)', () => {
  test('remove variáveis Azure e MODEL_PROVIDER e preserva o resto', () => {
    const env = ambienteSemAzure({ ...completo, MODEL_PROVIDER: 'azure', AZURE_OPENAI_TIMEOUT_MS: '1', PATH: '/bin', AVALIACAO_PERFIL: 'offline' });
    expect(Object.keys(env).some((k) => k.startsWith('AZURE_') || k === 'MODEL_PROVIDER')).toBe(false);
    expect(env.PATH).toBe('/bin');
    expect(env.AVALIACAO_PERFIL).toBe('offline');
  });
});
