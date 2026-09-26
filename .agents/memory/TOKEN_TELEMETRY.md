# 📊 Relatório de Telemetria de Tokens — Antigravity
> **Status:** 🟡 Atenção (>50%) | **Última Leitura:** 2026-09-26 19:43:43  
> **Sessão:** `ba5a0bef-eb18-43cc-a06d-c7ac404202d0` | **Modelo Utilizado:** `Gemini 3.8 Flash` (`gemini-3.8-flash`) | **Effort:** `Medium`  
> **Limites do Modelo:** Janela de Contexto: `1.05M` (`1,048,576` tokens) | Saída Máxima: `65.5k` (`65,536` tokens)

---

## 1. As 3 Camadas de Limites no Antigravity (<Usado> / <Total>)

| Camada de Limite | Consumo Usado | Teto / Limite Total | Utilizado (%) | Margem Restante | Status & Ritmo |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Janela de Mensagem (Context)** | `250.2k` tokens | `1.05M` | **23.86%** | `798.3k` livres | Ativa na sessão |
| **2. Janela Móvel de 5 Horas (Rate)** | `531.6k` tokens | `800.0k` | **66.45%** | `268.4k` livres | 6 sessões (~106.3k/h) |
| **3. Janela Semanal (7 Dias Quota)** | `4.59M` tokens | `10.00M` | **45.91%** | `5.41M` livres | 59 sessões (~655.9k/dia) |

---

## 2. Distribuição de Consumo da Sessão Atual
| Categoria | Tokens Estimados | Bytes | Participação |
| :--- | :--- | :--- | :--- |
| **System Prompt & Schemas** | `35.8k` | 117,996 B | 14.3% |
| **Execuções de Ferramentas** | `180.8k` | 578,584 B | 72.3% |
| **Respostas & Thinking** | `30.7k` | 107,509 B | 12.3% |
| **Mensagens do Usuário** | `3.0k` | 11,806 B | 1.2% |

---

## 3. Top Ferramentas Consumidoras
| `GENERIC` | 447 | 164.1k | 525,238 B |
| `SYSTEM_MESSAGE` | 18 | 8.7k | 27,835 B |
| `EPHEMERAL_MESSAGE` | 29 | 8.0k | 25,511 B |

---

## 4. Recomendações de Governança
- **Janela de 5 Horas:** Consumo atual em **66.4%** do teto (268.4k disponíveis). Mantenha comandos e testes com saída concisa.
- **Janela Semanal:** Consumo atual em **45.9%** da cota semanal (5.41M disponíveis). Utilize `PROJECT_MEMORY.md` para resetar sessões longas ao concluir marcos.
