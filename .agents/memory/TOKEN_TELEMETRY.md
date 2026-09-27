# 📊 Relatório de Telemetria de Tokens — Antigravity
> **Status:** 🔴 Crítico (>80%) | **Última Leitura:** 2026-09-27 19:03:43  
> **Sessão:** `6c439589-018c-4319-8b0f-2ce04739529d` | **Modelo Utilizado:** `Claude Sonnet 4.6` (`claude-sonnet-4-6`) | **Effort:** `High`  
> **Limites do Modelo:** Janela de Contexto: `200.0k` (`200,000` tokens) | Saída Máxima: `8.2k` (`8,192` tokens)

---

## 1. As 3 Camadas de Limites no Antigravity (<Usado> / <Total>)

| Camada de Limite | Consumo Usado | Teto / Limite Total | Utilizado (%) | Margem Restante | Status & Ritmo |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Janela de Mensagem (Context)** | `215.0k` tokens | `200.0k` | **107.50%** | `0` livres | Ativa na sessão |
| **2. Janela Móvel de 5 Horas (Rate)** | `374.7k` tokens | `800.0k` | **46.84%** | `425.3k` livres | 2 sessões (~74.9k/h) |
| **3. Janela Semanal (7 Dias Quota)** | `5.47M` tokens | `10.00M` | **54.65%** | `4.53M` livres | 65 sessões (~780.8k/dia) |

---

## 2. Distribuição de Consumo da Sessão Atual
| Categoria | Tokens Estimados | Bytes | Participação |
| :--- | :--- | :--- | :--- |
| **System Prompt & Schemas** | `35.8k` | 117,996 B | 16.6% |
| **Execuções de Ferramentas** | `157.8k` | 505,081 B | 73.4% |
| **Respostas & Thinking** | `17.3k` | 60,503 B | 8.0% |
| **Mensagens do Usuário** | `4.1k` | 16,503 B | 1.9% |

---

## 3. Top Ferramentas Consumidoras
| `VIEW_FILE` | 159 | 122.2k | 390,920 B |
| `CODE_ACTION` | 47 | 21.2k | 67,777 B |
| `RUN_COMMAND` | 47 | 10.9k | 34,841 B |
| `SYSTEM_MESSAGE` | 4 | 2.7k | 8,646 B |
| `GREP_SEARCH` | 4 | 665 | 2,129 B |
| `ERROR_MESSAGE` | 5 | 240 | 768 B |

---

## 4. Recomendações de Governança
- **Janela de 5 Horas:** Consumo atual em **46.8%** do teto (425.3k disponíveis). Mantenha comandos e testes com saída concisa.
- **Janela Semanal:** Consumo atual em **54.7%** da cota semanal (4.53M disponíveis). Utilize `PROJECT_MEMORY.md` para resetar sessões longas ao concluir marcos.
