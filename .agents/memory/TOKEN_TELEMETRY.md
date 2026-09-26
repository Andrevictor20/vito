# 📊 Relatório de Telemetria de Tokens — Antigravity
> **Status:** 🟡 Atenção (>50%) | **Última Leitura:** 2026-09-26 17:57:41  
> **Sessão:** `ba5a0bef-eb18-43cc-a06d-c7ac404202d0` | **Modelo Utilizado:** `Gemini 3.8 Flash` (`gemini-3.8-flash`) | **Effort:** `Medium`  
> **Limites do Modelo:** Janela de Contexto: `1.05M` (`1,048,576` tokens) | Saída Máxima: `65.5k` (`65,536` tokens)

---

## 1. As 3 Camadas de Limites no Antigravity (<Usado> / <Total>)

| Camada de Limite | Consumo Usado | Teto / Limite Total | Utilizado (%) | Margem Restante | Status & Ritmo |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Janela de Mensagem (Context)** | `68.0k` tokens | `1.05M` | **6.48%** | `980.6k` livres | Ativa na sessão |
| **2. Janela Móvel de 5 Horas (Rate)** | `512.8k` tokens | `800.0k` | **64.10%** | `287.2k` livres | 7 sessões (~102.6k/h) |
| **3. Janela Semanal (7 Dias Quota)** | `4.41M` tokens | `10.00M` | **44.09%** | `5.59M` livres | 59 sessões (~629.9k/dia) |

---

## 2. Distribuição de Consumo da Sessão Atual
| Categoria | Tokens Estimados | Bytes | Participação |
| :--- | :--- | :--- | :--- |
| **System Prompt & Schemas** | `35.3k` | 116,589 B | 52.0% |
| **Execuções de Ferramentas** | `29.7k` | 94,939 B | 43.6% |
| **Respostas & Thinking** | `2.5k` | 8,868 B | 3.7% |
| **Mensagens do Usuário** | `456` | 1,826 B | 0.7% |

---

## 3. Top Ferramentas Consumidoras
| `GENERIC` | 72 | 28.6k | 91,595 B |
| `EPHEMERAL_MESSAGE` | 4 | 1.0k | 3,344 B |

---

## 4. Recomendações de Governança
- **Janela de 5 Horas:** Consumo atual em **64.1%** do teto (287.2k disponíveis). Mantenha comandos e testes com saída concisa.
- **Janela Semanal:** Consumo atual em **44.1%** da cota semanal (5.59M disponíveis). Utilize `PROJECT_MEMORY.md` para resetar sessões longas ao concluir marcos.
