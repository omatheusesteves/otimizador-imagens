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

## Observações

- AVIF usa WebAssembly e pode levar alguns segundos em imagens grandes.
- PNG permanece sem perda quando o formato original é escolhido.
- JPEG e WebP usam compressão com perda controlada pelo ajuste de qualidade.
- A recodificação remove metadados desnecessários, reduzindo o peso final.
