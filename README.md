# PEREIRA X — Loja virtual local

Primeira versão funcional para executar no Windows. Inclui catálogo ligado ao SQLite, carrinho persistido no navegador, checkout de demonstração, pedidos persistidos, autenticação administrativa por sessão e gestão de produtos/pedidos.

## Requisitos
- Windows 10/11
- Node.js 20 LTS ou superior (instale em https://nodejs.org/)
- PowerShell ou Terminal do Windows

## Instalação (modo mais fácil)
1. Extraia o ZIP em uma pasta, por exemplo `C:\PereiraX`.
2. Dê dois cliques em `INICIAR-PEREIRA-X.bat`.
3. O instalador verifica o Node.js, cria o `.env` automaticamente (com a senha inicial pedida), instala as dependências e inicia a loja.
4. Quando aparecer a mensagem de inicialização, abra http://localhost:5173.

## Instalação manual
1. Extraia o ZIP em uma pasta e abra o terminal nessa pasta.
2. Instale as dependências:

   ```powershell
   npm install
   ```

3. Crie o arquivo `.env` a partir do exemplo:

   ```powershell
   Copy-Item .env.example .env
   ```

4. Abra `.env` e configure pelo menos:
   - `ADMIN_USERNAME=admin`
   - `ADMIN_PASSWORD=pereira0818`
   - `SESSION_SECRET=` uma chave longa e aleatória (não compartilhe)
   - `NODE_ENV=development`

   A senha fica somente no servidor, no `.env`, que é ignorado pelo Git. Troque a senha antes de qualquer uso fora do computador local.

5. Inicie a loja e a API:

   ```powershell
   npm run dev
   ```

6. Abra:
   - Loja: http://localhost:5173
   - API: http://localhost:3001/api/health
   - Painel: clique no ícone de usuário ou acesse http://localhost:5173 e depois a área administrativa.

   Login inicial: `admin` / `pereira0818` (desde que configurado no `.env`).

## Banco de dados
O arquivo `data/pereira-x.sqlite` é criado automaticamente na primeira inicialização. Categorias e seis produtos de exemplo são inseridos se o catálogo estiver vazio. Pedidos e itens são gravados no SQLite; o estoque é revalidado e reduzido dentro de uma transação no servidor. Os dados permanecem após fechar o navegador ou o servidor.

## Funcionalidades
- Pesquisa por nome e filtro de categoria no catálogo.
- Carrinho com quantidades, limite de estoque e persistência via localStorage.
- Checkout com validação de dados, frete de demonstração e formas de pagamento fictícias.
- Nenhum pagamento real é processado; não há campo para número de cartão ou CVV.
- Login administrativo validado no backend, sessão armazenada no próprio SQLite e cookie HttpOnly, limite de tentativas e rotas administrativas protegidas no servidor.
- Dashboard com estatísticas reais do SQLite, CRUD de produtos (exclusão lógica) e atualização de status de pedidos.

## Observações importantes de segurança
- Este projeto é uma base local de primeira versão, não uma implantação pronta para produção pública.
- Não exponha a API diretamente à internet. Para publicar, configure HTTPS, `SESSION_SECRET` forte, política de origem/CORS, proteção CSRF apropriada ao domínio, backup do SQLite, monitoramento e revisão de segurança.
- O cookie usa `SameSite=Strict` e `HttpOnly`; `Secure` é ativado quando `NODE_ENV=production`.
- As imagens de exemplo usam URLs externas do Unsplash; substitua por imagens próprias para operação comercial.
- Produtos e pedidos iniciais são demonstrações. Não representam vendas reais.
- A senha inicial solicitada é fraca para uso público. Altere-a antes de qualquer publicação.

## Comandos úteis
- `npm run dev`: inicia frontend e backend em modo desenvolvimento.
- `npm run build`: compila o frontend.
- `npm start`: inicia o backend (para uso local com frontend já compilado/configurado).

## Estrutura
- `src/`: interface React e estilos.
- `server/index.ts`: API Express, SQLite, sessões e validações.
- `data/`: banco SQLite criado automaticamente (não versionado).


## Se não iniciar
- Confirme que o Node.js está instalado: abra um terminal e execute `node -v` e `npm -v`.
- Execute `INICIAR-PEREIRA-X.bat` dentro da pasta extraída, não dentro do ZIP.
- Mantenha a janela do terminal aberta enquanto usa o site.
- Se a porta 5173 ou 3001 estiver ocupada, feche a outra aplicação que a utiliza.
- Se `npm install` falhar, copie a mensagem completa do terminal para que o erro específico possa ser corrigido.
