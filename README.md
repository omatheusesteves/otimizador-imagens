# Otimizador de Imagens

Aplicação 100% client-side para converter imagens em WebP ou AVIF e otimizar
PNG, JPEG e WebP mantendo a extensão original. Os arquivos são processados no
próprio navegador e nunca são enviados para servidores.

## Recursos

- Conversão em lote para WebP e AVIF.
- Otimização de PNG sem perda usando OxiPNG.
- Otimização de JPEG e WebP com controle de qualidade.
- Redimensionamento proporcional opcional.
- Download individual ou de todos os resultados em ZIP.
- Proteção contra aumento de tamanho ao manter o formato original.
- Interface responsiva e acessível.

## Rodar localmente

Use Node.js 22 ou superior:

```bash
npm install
npm run dev
```

## Gerar os arquivos de produção

```bash
npm install
npm run build
```

O resultado será criado na pasta `dist`.

## Publicar na Hostinger

1. Execute `npm run build`.
2. Abra o Gerenciador de Arquivos da Hostinger.
3. Envie **o conteúdo** da pasta `dist` para `public_html`.
4. Acesse o domínio e teste uma conversão.

Não é necessário PHP, banco de dados ou servidor Node.js.

## Publicar no GitHub Pages

O projeto inclui o workflow `.github/workflows/deploy-pages.yml`.

1. Envie o projeto para um repositório no GitHub.
2. Em **Settings → Pages**, selecione **GitHub Actions**.
3. Faça push para a branch `main`.
4. Aguarde a action “Publicar no GitHub Pages”.

O caminho dos arquivos já está configurado para funcionar em uma subpasta como
`usuario.github.io/nome-do-repositorio/`.

## Observações

- AVIF usa WebAssembly e pode levar alguns segundos em imagens grandes.
- PNG permanece sem perda quando o formato original é escolhido.
- JPEG e WebP usam compressão com perda controlada pelo ajuste de qualidade.
- A recodificação remove metadados desnecessários, reduzindo o peso final.
