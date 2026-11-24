# Desvios e Limitações Documentadas do Protótipo (Plano 10)

Este documento registra os desvios intencionais ou pendências de ambiente entre `Vito-telas-atualizadas.html` e o app mobile React Native / Expo (`0.1.33`):

1. **Dados 100% dinâmicos (não estáticos):**
   - Ao contrário das fixtures fixas do protótipo HTML (`André Victor`, saldos e transações mockadas), todas as telas consomem dados reais da API, banco local e estado autenticado do usuário.
2. **Ícones e Logos:**
   - Todos os ícones de interface em `mobile/src/` usam SVG próprio (`ProtoUiIcons.tsx`) e logos multi-camada extraídos (`IconRegistry.tsx`, `SvgTree.tsx`), com `0` dependências de `@expo/vector-icons` em código de produção.
   - `Servidor do Vito` em Provedores de IA utiliza `<MascotVectorRig />` adaptado ao tema claro/escuro.
3. **Gate de Emulador Android (§3.5.6):**
   - Durante o fechamento da Onda 11 em `2026-11-23`, `adb devices` não listou nenhum emulador Android ou dispositivo conectado neste ambiente Linux. Toda a verificação visual (Light & Dark `390×844`), `tsc --noEmit`, `490` testes unitários e `expo export --platform web` passaram com sucesso; recomenda-se validar a build nativa no emulador Android quando disponível.
