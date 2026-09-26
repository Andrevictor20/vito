# 📊 Relatório de Telemetria de Tokens — Antigravity
> **Status:** 🟡 Atenção (>50%) | **Última Leitura:** 2026-09-26 20:39:56  
> **Sessão:** `803890b3-c25a-4657-b491-3a9d66e4b030` | **Modelo Utilizado:** `Gemini 3.8 Flash` (`gemini-3.8-flash`) | **Effort:** `Medium`  
> **Limites do Modelo:** Janela de Contexto: `1.05M` (`1,048,576` tokens) | Saída Máxima: `65.5k` (`65,536` tokens)

---

## 1. As 3 Camadas de Limites no Antigravity (<Usado> / <Total>)

| Camada de Limite | Consumo Usado | Teto / Limite Total | Utilizado (%) | Margem Restante | Status & Ritmo |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Janela de Mensagem (Context)** | `65.3k` tokens | `1.05M` | **6.23%** | `983.3k` livres | Ativa na sessão |
| **2. Janela Móvel de 5 Horas (Rate)** | `599.4k` tokens | `800.0k` | **74.93%** | `200.6k` livres | 6 sessões (~119.9k/h) |
| **3. Janela Semanal (7 Dias Quota)** | `4.68M` tokens | `10.00M` | **46.82%** | `5.32M` livres | 60 sessões (~668.8k/dia) |

---

## 2. Distribuição de Consumo da Sessão Atual
| Categoria | Tokens Estimados | Bytes | Participação |
| :--- | :--- | :--- | :--- |
| **System Prompt & Schemas** | `35.8k` | 117,996 B | 54.8% |
| **Execuções de Ferramentas** | `24.5k` | 78,509 B | 37.6% |
| **Respostas & Thinking** | `4.6k` | 16,076 B | 7.0% |
| **Mensagens do Usuário** | `404` | 1,618 B | 0.6% |

---

## 3. Top Ferramentas Consumidoras
| `GENERIC` | 62 | 21.7k | 69,581 B |
| `SYSTEM_MESSAGE` | 2 | 1.5k | 4,670 B |
| `EPHEMERAL_MESSAGE` | 5 | 1.3k | 4,258 B |

---

## 4. Recomendações de Governança
- **Janela de 5 Horas:** Consumo atual em **74.9%** do teto (200.6k disponíveis). Mantenha comandos e testes com saída concisa.
- **Janela Semanal:** Consumo atual em **46.8%** da cota semanal (5.32M disponíveis). Utilize `PROJECT_MEMORY.md` para resetar sessões longas ao concluir marcos.
