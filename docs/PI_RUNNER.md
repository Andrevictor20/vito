# PI_RUNNER — Runner self-hosted arm64 + deploy Vito no Raspberry Pi (Lote E §11)

Guia passo a passo para operar o deploy automático (`ci.yml` → job `deploy`)
no Raspberry Pi 4 (arm64) a partir da imagem publicada
`ghcr.io/andrevictor20/vito:latest`.

> O job `deploy` usa o compose único:
> `docker compose pull/up` (sem `-f`, sem override).
> O `docker-compose.yml` contém **só `image:` + `pull_policy: always`**,
> **sem `build:`** — o Pi nunca compila, apenas puxa a imagem multi-arch
> (`linux/amd64`, `linux/arm64`) publicada pelo job `docker-publish`.

## 0. Pré-requisitos

- Raspberry Pi 4 (4–8 GB) com Raspberry Pi OS 64-bit (arm64).
- Docker Engine + Compose plugin instalados e usuário no grupo `docker`.
- Repo clonado em `~/vito` com remote `origin` apontando para o GitHub.
- Acesso a `Settings > Actions > Runners` do repositório no GitHub.

## 1. Preparar o Pi (uma vez)

```bash
# 1. Docker + compose plugin (se ainda não tem)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# relogue, depois confira:
docker --version
docker compose version

# 2. Clonar o repo em ~/vito
cd ~
git clone <URL_DO_REPO> vito
cd ~/vito
git remote -v   # deve mostrar origin

# 3. Criar o .env de produção (NÃO commitar)
cp .env.example .env
nano .env
```

### 3.1. Variáveis obrigatórias no `.env`

```env
PORT=8180
APP_ENV=production
JWT_SECRET=<mínimo 32 chars aleatórios>
DATA_ENCRYPTION_KEY=<mínimo 32 chars aleatórios, diferente do JWT_SECRET>
SHORTIO_API_KEY=<sua chave Short.io>
SHORTIO_DOMAIN=vito.s.gy
MISTRAL_API_KEY=<sua chave Mistral (La Plateforme, free mode)>
# MISTRAL_MODEL opcional (default: ministral-8b-latest)
PUBLIC_BASE_URL=https://vito.rasppi.cloud
GOOGLE_REDIRECT_URL=https://vito.rasppi.cloud/api/v1/auth/google/callback
# Origens de browser autorizadas (SEC-03). Sem esta var, produção só aceita o
# PUBLIC_BASE_URL e o web dev (ex: http://localhost:8081 no notebook) cai no
# preflight CORS. Formato: vírgula, sem barra no fim, sem aspas.
CORS_ALLOWED_ORIGINS=https://vito.rasppi.cloud,http://localhost:8081
CLOUDFLARE_TUNNEL_TOKEN=<token do tunnel, se usar perfil tunnel>
```

Gere segredos fortes (exemplo):

```bash
openssl rand -base64 48
```

- `JWT_SECRET` e `DATA_ENCRYPTION_KEY` com **>= 32 caracteres** (o backend
  recusa boot em `APP_ENV=production` caso contrário — ver
  `backend/internal/config/config.go` `Validate()`).
- `SHORTIO_API_KEY` sem fallback: se vazio, o encurtador apenas desliga
  (fallback `""` em `config.go`), sem quebrar o boot.
- Nunca coloque valores reais em `.env.example` (só chaves vazias).

## 2. Instalar o runner self-hosted arm64 (uma vez)

No GitHub: `Settings > Actions > Runners > New self-hosted runner`,
imagem **Linux**, arquitetura **ARM64**. Depois no Pi:

```bash
mkdir -p ~/actions-runner && cd ~/actions-runner
# baixe o pacote linux-arm64 indicado na página (exemplo):
curl -o actions-runner-linux-arm64.tar.gz -L <URL_MOSTRADA_NO_GITHUB>
tar xzf actions-runner-linux-arm64.tar.gz
./config.sh --url https://github.com/andrevictor20/vito --token <TOKEN>
# teste em foreground:
./run.sh
```

Para rodar como serviço (recomendado):

```bash
sudo ./svc.sh install
sudo ./svc.sh start
sudo ./svc.sh status
```

Confira na página de Runners que aparece:
`self-hosted, linux, arm64` (labels exigidos pelo job `deploy`:
`runs-on: [self-hosted, linux, arm64]`).

## 3. Primeiro deploy manual (validação)

```bash
cd ~/vito
git fetch origin main
git reset --hard origin/main
echo "${GITHUB_TOKEN}" | docker login ghcr.io -u <seu-usuario> --password-stdin
# Para teste local sem token pessoal, o login no CI usa secrets.GITHUB_TOKEN.
docker compose pull backend
docker compose up -d --force-recreate --remove-orphans backend
docker image prune -f
sleep 5
wget -qO- http://localhost:8180/healthz
docker compose config
```

O `healthz` deve responder `200`. O `config` deve mostrar o `backend`
**sem `build:`**, com `image: ghcr.io/andrevictor20/vito:latest` e
`pull_policy: always`.

## 4. Como funciona o CD

1. Push em `main` → `test` → `docker-publish` (buildx multi-arch + push
   `latest` + `sha`) → `deploy` (só no runner do Pi).
2. O `deploy` faz `git fetch + reset --hard origin/main` em `~/vito`,
   `pull` + `up -d` (compose único, sem `-f`), `image prune` e `wget /healthz`.
3. Rollback rápido: `git reset --hard <sha-anterior> &&
   docker compose up -d backend`.

## 5. Troubleshooting

| Sintoma | Causa provável | Ação |
|---|---|---|
| Job `deploy` preso em **Queued** por horas | runner nunca instalado, offline (Pi reiniciou) ou labels divergentes — o job exige `runs-on: [self-hosted, linux, arm64]` | confira `Settings > Actions > Runners` (deve estar verde com os 3 labels); no Pi: `sudo ./svc.sh start && sudo ./svc.sh status` em `~/actions-runner` |
| Run antigo destravou mas deployou commit velho | o Queued retoma de onde parou | **Cancel workflow** no run antigo e **Re-run failed jobs** (ou push novo) após o runner ficar verde |
| Runner offline | `svc.sh` parado / Pi reiniciou | `sudo ./svc.sh start && sudo ./svc.sh status` |
| `pull` pede login | token expirado | refaça `docker login ghcr.io` (CI usa `GITHUB_TOKEN` automático) |
| `/healthz` sem resposta | `.env` incompleto / porta ocupada | `docker logs vito-backend`; confira `JWT_SECRET`/`DATA_ENCRYPTION_KEY>=32` |
| Preflight CORS falha no web dev | `CORS_ALLOWED_ORIGINS` sem a origem do browser | inclua `http://localhost:8081` (notebook) na var + `up -d --force-recreate backend` (`restart` sozinho não relê o `.env`) |
| Disco cheio | imagens antigas | `docker image prune -f && docker system df` |
