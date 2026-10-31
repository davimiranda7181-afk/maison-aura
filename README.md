# Maison Aura · Loja virtual de perfumes

Vitrine de perfumaria multimarcas com pedidos finalizados pelo WhatsApp.
HTML, CSS e JavaScript puro, empacotados com Vite. Catálogo e configurações no Supabase.

- **Vitrine:** catálogo com busca, filtros e ordenação; página de produto com escolha de volume; sacola salva no navegador; favoritos; recomendação de fragrâncias.
- **Pedido:** a revisão do pedido gera a mensagem e abre `https://wa.me/NUMERO?text=...`. A loja confirma disponibilidade, frete e pagamento na conversa.
- **Painel (`/admin`):** login pelo Supabase Auth. Permite cadastrar produtos, volumes, preços, estoque, fotos, marcas e categorias, e editar dados e textos da loja.
- **Modo demonstração:** sem Supabase, a loja mostra 15 produtos fictícios identificados como demonstração. O painel fica bloqueado e a vitrine não é indexada.

---

## 1. Executar no computador

Requisitos: Node.js 20 ou mais recente.

```bash
npm install
cp .env.example .env      # preencha os valores (veja abaixo)
npm run dev               # abre em http://localhost:5173
```

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | compila para `dist/` e gera `robots.txt` e `sitemap.xml` |
| `npm run preview` | serve a versão compilada |
| `npm test` | testes unitários e de banco de dados (PostgreSQL embutido) |
| `CHROME_PATH=/caminho/do/chrome npm run test:e2e` | testes de ponta a ponta num navegador real |
| `npm run demo-images` | regenera as ilustrações dos produtos de demonstração |

## 2. Configurar o número de WhatsApp

O número fica em um único lugar: a variável `VITE_WHATSAPP_NUMBER`. O código lê esse valor em `src/lib/config.js` e o valida em `src/lib/whatsapp.js`.

Use o formato internacional, **somente números**: código do país + DDD + número.

```
VITE_WHATSAPP_NUMBER=5571999998888
```

- No computador, coloque no arquivo `.env`.
- Na hospedagem (Vercel, Netlify), cadastre em *Environment Variables* e publique de novo. O valor é gravado no site durante a compilação.

Se o número estiver vazio ou fora do formato (com `+`, espaços, traços, menos de 10 ou mais de 15 dígitos), o site não gera nenhum link. Nesse caso a revisão do pedido avisa que o atendimento não está configurado e oferece copiar a mensagem. O botão flutuante não aparece.

## 3. Ativar o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Abra **SQL Editor → New query**, cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**. O script cria as tabelas, as validações, as políticas de segurança (RLS), a função `save_product` e o bucket de imagens `product-images`. Ele pode ser executado de novo sem perder dados.
3. Em **Authentication → Users → Add user**, crie o usuário administrador com e-mail e senha forte.
4. Abra `supabase/add-admin.sql`, troque o e-mail pelo do administrador e execute no SQL Editor.
5. Em **Project Settings → API**, copie a *Project URL* e a chave pública (**anon** ou **publishable**) para o `.env`:
   ```
   VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...   (ou sb_publishable_...)
   ```
6. Em **Authentication → URL Configuration**, coloque o endereço do site em *Site URL* e adicione `https://seu-dominio/admin.html` em *Redirect URLs*. Isso faz o link de "Esqueci a senha" funcionar.
7. Publique o site de novo.

> **Nunca use a chave `service_role` ou `secret` no site.** Ela ignora todas as regras de segurança. Se ela for colocada em `VITE_SUPABASE_ANON_KEY`, o site a recusa e registra um erro. Nesse caso, troque a chave no painel do Supabase, porque ela já foi exposta.

**Quem pode fazer o quê** (garantido pelo banco, não pelo JavaScript):

| | Visitante | Usuário logado comum | Administrador |
|---|---|---|---|
| Ver produtos ativos, marcas, categorias, configurações | ✓ | ✓ | ✓ (inclusive ocultos) |
| Inscrever-se na newsletter (com consentimento) | ✓ | ✓ | ✓ |
| Ler a lista da newsletter | — | — | ✓ |
| Criar/editar produtos, preços, estoque, fotos, dados da loja | — | — | ✓ |
| Tornar alguém administrador | — | — | só pelo SQL Editor |

## 4. Cadastrar produtos e imagens

1. Acesse `https://seu-dominio/admin` e entre com o usuário administrador.
2. **Marcas:** cadastre as marcas que a loja vende.
3. **Categorias (opcional):** crie uma categoria com endereço `importados` para alimentar a página "Perfumes importados". Outras categorias ficam em `/colecao/<endereço>`.
4. **Produtos → Novo produto:**
   - Nome, marca, tipo (perfume ou kit), gênero, família olfativa e concentração.
   - **Volumes:** um por linha, com rótulo ("50 ml"), ml, preço, promoção opcional (menor que o preço), estoque e SKU. Estoque zero mostra o volume como indisponível.
   - **Perfil olfativo:** notas de saída, coração e fundo, ocasiões, intensidade e estilo. Use apenas dados do fabricante. Esses campos alimentam os filtros e o "Encontre sua fragrância"; campos vazios simplesmente não aparecem.
   - "Seleção da boutique" coloca o produto na vitrine da página inicial.
5. Salve o produto. Depois, em **Fotos**, envie as imagens (JPG, PNG, WebP ou AVIF). O painel reduz cada foto para no máximo 1600 px e converte para WebP antes do envio. Preencha o texto alternativo de cada foto. A primeira é a principal; a ordem pode ser alterada.

Use somente fotos reais e autorizadas do próprio produto. Produto sem foto mostra a imagem padrão "Foto em breve" (`public/images/fallback.svg`). Ela também substitui automaticamente qualquer imagem que falhe ao carregar.

**Etiquetas automáticas:**
- "Oferta" aparece quando um volume com estoque tem preço promocional.
- "Novidade" aparece nos produtos cadastrados há menos dias do que o configurado em *Dados da loja* (30 por padrão).
- "Indisponível" aparece quando nenhum volume tem estoque.

Não existe etiqueta de "Mais vendido" nem avaliações, porque a loja não tem dados de venda ou avaliações verificadas.

**Dados da loja** (aba no painel): nome, mensagem da barra superior, e-mail, horário, redes sociais, razão social, CNPJ (valida os dígitos, inclusive no formato alfanumérico), endereço, formas de pagamento aceitas, benefícios da página inicial, perguntas frequentes e os textos de Sobre, Entrega, Trocas, Privacidade e Termos. Campos vazios ficam ocultos no site ou usam o texto padrão.

## 5. Publicar

**Vercel:** importe o repositório. O `vercel.json` já define o comando de build, a pasta `dist`, as rotas (incluindo `/admin`) e os cabeçalhos de segurança. Cadastre as variáveis `VITE_*` em *Settings → Environment Variables* e publique.

**Netlify:** comando `npm run build`, pasta `dist`. Os arquivos `public/_redirects` e `public/_headers` configuram rotas e cabeçalhos. Cadastre as variáveis `VITE_*` em *Site configuration → Environment variables*.

Defina também `VITE_SITE_URL=https://seu-dominio` (sem barra no final) para gerar o link canônico, os dados estruturados e o `sitemap.xml`. O sitemap inclui os produtos ativos lidos do Supabase no momento da compilação: publique de novo depois de cadastrar produtos novos.

Outra hospedagem estática funciona desde que todas as rotas desconhecidas sirvam `index.html` e `/admin` sirva `admin.html`.

---

## Estrutura

```
index.html, admin.html     páginas de entrada
src/main.js                rotas, eventos e inicialização da vitrine
src/views/                 páginas (início, catálogo, produto, pedido, institucionais)
src/ui/                    componentes, cabeçalho, rodapé, sacola, ícones
src/lib/                   regras: WhatsApp, sacola, filtros, recomendação, catálogo, SEO, formatação
src/data/                  vocabulário, configurações padrão e catálogo de demonstração
src/admin/                 painel administrativo
supabase/schema.sql        banco de dados, validações, RLS, storage
supabase/add-admin.sql     conceder acesso ao painel
scripts/                   pós-build (robots/sitemap) e geração das ilustrações de demonstração
tests/unit/                testes unitários e de banco (PGlite)
tests/e2e/                 testes no navegador, com Supabase simulado
```

## O que depende de configuração externa

- **Número de WhatsApp**: sem ele, nenhum pedido sai do site.
- **Supabase**: catálogo real, painel, fotos e newsletter. Sem ele, a loja fica em modo demonstração.
- **Envio da newsletter**: o site só guarda os e-mails com consentimento. Para enviar campanhas, exporte a lista em CSV pelo painel e importe num serviço de e-mail marketing (Brevo, Mailchimp, RD Station etc.).
- **Fotos dos produtos**: precisam ser enviadas pelo painel.
- **Textos legais**: os modelos de privacidade, termos e trocas devem ser revisados por assessoria jurídica e podem ser substituídos no painel.
- **Frete e pagamento**: combinados no WhatsApp. O site não calcula frete nem processa pagamentos.
