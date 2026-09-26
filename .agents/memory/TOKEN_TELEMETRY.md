# 📊 Relatório de Telemetria de Tokens — Antigravity
> **Status:** 🟡 Atenção (>50%) | **Última Leitura:** 2026-09-26 19:27:18  
> **Sessão:** `ba5a0bef-eb18-43cc-a06d-c7ac404202d0` | **Modelo Utilizado:** `Gemini 3.8 Flash` (`gemini-3.8-flash`) | **Effort:** `Medium`  
> **Limites do Modelo:** Janela de Contexto: `1.05M` (`1,048,576` tokens) | Saída Máxima: `65.5k` (`65,536` tokens)

---

## 1. As 3 Camadas de Limites no Antigravity (<Usado> / <Total>)

| Camada de Limite | Consumo Usado | Teto / Limite Total | Utilizado (%) | Margem Restante | Status & Ritmo |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Janela de Mensagem (Context)** | `196.8k` tokens | `1.05M` | **18.77%** | `851.7k` livres | Ativa na sessão |
| **2. Janela Móvel de 5 Horas (Rate)** | `478.3k` tokens | `800.0k` | **59.78%** | `321.7k` livres | 6 sessões (~95.7k/h) |
| **3. Janela Semanal (7 Dias Quota)** | `4.54M` tokens | `10.00M` | **45.38%** | `5.46M` livres | 59 sessões (~648.3k/dia) |

---

## 2. Distribuição de Consumo da Sessão Atual
| Categoria | Tokens Estimados | Bytes | Participação |
| :--- | :--- | :--- | :--- |
| **System Prompt & Schemas** | `35.8k` | 117,996 B | 18.2% |
| **Execuções de Ferramentas** | `131.0k` | 419,232 B | 66.6% |
| **Respostas & Thinking** | `27.3k` | 95,554 B | 13.9% |
| **Mensagens do Usuário** | `2.8k` | 11,130 B | 1.4% |

---

## 3. Top Ferramentas Consumidoras
| `GENERIC` | 369 | 115.4k | 369,130 B |
| `SYSTEM_MESSAGE` | 17 | 8.5k | 27,285 B |
| `EPHEMERAL_MESSAGE` | 26 | 7.1k | 22,817 B |

---

## 4. Recomendações de Governança
- **Janela de 5 Horas:** Consumo atual em **59.8%** do teto (321.7k disponíveis). Mantenha comandos e testes com saída concisa.
- **Janela Semanal:** Consumo atual em **45.4%** da cota semanal (5.46M disponíveis). Utilize `PROJECT_MEMORY.md` para resetar sessões longas ao concluir marcos.
