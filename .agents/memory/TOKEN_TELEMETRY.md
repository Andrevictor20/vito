# 📊 Relatório de Telemetria de Tokens — Antigravity
> **Status:** 🔴 Crítico (>80%) | **Última Leitura:** 2026-09-27 18:54:51  
> **Sessão:** `6c439589-018c-4319-8b0f-2ce04739529d` | **Modelo Utilizado:** `Claude Sonnet 4.6` (`claude-sonnet-4-6`) | **Effort:** `High`  
> **Limites do Modelo:** Janela de Contexto: `200.0k` (`200,000` tokens) | Saída Máxima: `8.2k` (`8,192` tokens)

---

## 1. As 3 Camadas de Limites no Antigravity (<Usado> / <Total>)

| Camada de Limite | Consumo Usado | Teto / Limite Total | Utilizado (%) | Margem Restante | Status & Ritmo |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Janela de Mensagem (Context)** | `206.4k` tokens | `200.0k` | **103.22%** | `0` livres | Ativa na sessão |
| **2. Janela Móvel de 5 Horas (Rate)** | `366.2k` tokens | `800.0k` | **45.77%** | `433.8k` livres | 2 sessões (~73.2k/h) |
| **3. Janela Semanal (7 Dias Quota)** | `5.46M` tokens | `10.00M` | **54.57%** | `4.54M` livres | 65 sessões (~779.6k/dia) |

---

## 2. Distribuição de Consumo da Sessão Atual
| Categoria | Tokens Estimados | Bytes | Participação |
| :--- | :--- | :--- | :--- |
| **System Prompt & Schemas** | `35.8k` | 117,996 B | 17.3% |
| **Execuções de Ferramentas** | `150.2k` | 480,597 B | 72.7% |
| **Respostas & Thinking** | `16.6k` | 58,193 B | 8.1% |
| **Mensagens do Usuário** | `3.9k` | 15,516 B | 1.9% |

---

## 3. Top Ferramentas Consumidoras
| `VIEW_FILE` | 152 | 117.0k | 374,312 B |
| `CODE_ACTION` | 45 | 20.1k | 64,288 B |
| `RUN_COMMAND` | 44 | 10.3k | 32,975 B |
| `SYSTEM_MESSAGE` | 3 | 1.9k | 6,125 B |
| `GREP_SEARCH` | 4 | 665 | 2,129 B |
| `ERROR_MESSAGE` | 5 | 240 | 768 B |

---

## 4. Recomendações de Governança
- **Janela de 5 Horas:** Consumo atual em **45.8%** do teto (433.8k disponíveis). Mantenha comandos e testes com saída concisa.
- **Janela Semanal:** Consumo atual em **54.6%** da cota semanal (4.54M disponíveis). Utilize `PROJECT_MEMORY.md` para resetar sessões longas ao concluir marcos.
