# 📊 Relatório de Telemetria de Tokens — Antigravity
> **Status:** 🔴 Crítico (>80%) | **Última Leitura:** 2026-09-26 21:33:03  
> **Sessão:** `803890b3-c25a-4657-b491-3a9d66e4b030` | **Modelo Utilizado:** `Gemini 3.8 Flash` (`gemini-3.8-flash`) | **Effort:** `Medium`  
> **Limites do Modelo:** Janela de Contexto: `1.05M` (`1,048,576` tokens) | Saída Máxima: `65.5k` (`65,536` tokens)

---

## 1. As 3 Camadas de Limites no Antigravity (<Usado> / <Total>)

| Camada de Limite | Consumo Usado | Teto / Limite Total | Utilizado (%) | Margem Restante | Status & Ritmo |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Janela de Mensagem (Context)** | `146.0k` tokens | `1.05M` | **13.92%** | `902.6k` livres | Ativa na sessão |
| **2. Janela Móvel de 5 Horas (Rate)** | `680.0k` tokens | `800.0k` | **85.00%** | `120.0k` livres | 6 sessões (~136.0k/h) |
| **3. Janela Semanal (7 Dias Quota)** | `4.76M` tokens | `10.00M` | **47.62%** | `5.24M` livres | 60 sessões (~680.3k/dia) |

---

## 2. Distribuição de Consumo da Sessão Atual
| Categoria | Tokens Estimados | Bytes | Participação |
| :--- | :--- | :--- | :--- |
| **System Prompt & Schemas** | `35.8k` | 117,996 B | 24.5% |
| **Execuções de Ferramentas** | `91.2k` | 291,694 B | 62.4% |
| **Respostas & Thinking** | `17.8k` | 62,454 B | 12.2% |
| **Mensagens do Usuário** | `1.3k` | 5,027 B | 0.9% |

---

## 3. Top Ferramentas Consumidoras
| `GENERIC` | 219 | 77.3k | 247,335 B |
| `SYSTEM_MESSAGE` | 14 | 8.2k | 26,143 B |
| `EPHEMERAL_MESSAGE` | 21 | 5.7k | 18,216 B |

---

## 4. Recomendações de Governança
- **Janela de 5 Horas:** Consumo atual em **85.0%** do teto (120.0k disponíveis). Mantenha comandos e testes com saída concisa.
- **Janela Semanal:** Consumo atual em **47.6%** da cota semanal (5.24M disponíveis). Utilize `PROJECT_MEMORY.md` para resetar sessões longas ao concluir marcos.
