# 📊 Relatório de Telemetria de Tokens — Antigravity
> **Status:** 🔴 Crítico (>80%) | **Última Leitura:** 2026-09-27 19:08:52  
> **Sessão:** `6c439589-018c-4319-8b0f-2ce04739529d` | **Modelo Utilizado:** `Claude Sonnet 4.6` (`claude-sonnet-4-6`) | **Effort:** `High`  
> **Limites do Modelo:** Janela de Contexto: `200.0k` (`200,000` tokens) | Saída Máxima: `8.2k` (`8,192` tokens)

---

## 1. As 3 Camadas de Limites no Antigravity (<Usado> / <Total>)

| Camada de Limite | Consumo Usado | Teto / Limite Total | Utilizado (%) | Margem Restante | Status & Ritmo |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Janela de Mensagem (Context)** | `221.1k` tokens | `200.0k` | **110.53%** | `0` livres | Ativa na sessão |
| **2. Janela Móvel de 5 Horas (Rate)** | `380.8k` tokens | `800.0k` | **47.60%** | `419.2k` livres | 2 sessões (~76.2k/h) |
| **3. Janela Semanal (7 Dias Quota)** | `5.47M` tokens | `10.00M` | **54.72%** | `4.53M` livres | 65 sessões (~781.6k/dia) |

---

## 2. Distribuição de Consumo da Sessão Atual
| Categoria | Tokens Estimados | Bytes | Participação |
| :--- | :--- | :--- | :--- |
| **System Prompt & Schemas** | `35.8k` | 117,996 B | 16.2% |
| **Execuções de Ferramentas** | `162.8k` | 520,970 B | 73.6% |
| **Respostas & Thinking** | `18.1k` | 63,418 B | 8.2% |
| **Mensagens do Usuário** | `4.4k` | 17,520 B | 2.0% |

---

## 3. Top Ferramentas Consumidoras
| `VIEW_FILE` | 163 | 125.0k | 400,071 B |
| `CODE_ACTION` | 50 | 22.7k | 72,619 B |
| `RUN_COMMAND` | 50 | 11.2k | 35,843 B |
| `SYSTEM_MESSAGE` | 5 | 3.0k | 9,540 B |
| `GREP_SEARCH` | 4 | 665 | 2,129 B |
| `ERROR_MESSAGE` | 5 | 240 | 768 B |

---

## 4. Recomendações de Governança
- **Janela de 5 Horas:** Consumo atual em **47.6%** do teto (419.2k disponíveis). Mantenha comandos e testes com saída concisa.
- **Janela Semanal:** Consumo atual em **54.7%** da cota semanal (4.53M disponíveis). Utilize `PROJECT_MEMORY.md` para resetar sessões longas ao concluir marcos.
