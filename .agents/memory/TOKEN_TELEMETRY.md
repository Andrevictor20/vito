# 📊 Relatório de Telemetria de Tokens — Antigravity
> **Status:** 🟡 Atenção (>50%) | **Última Leitura:** 2026-09-26 18:48:23  
> **Sessão:** `ba5a0bef-eb18-43cc-a06d-c7ac404202d0` | **Modelo Utilizado:** `Gemini 3.8 Flash` (`gemini-3.8-flash`) | **Effort:** `Medium`  
> **Limites do Modelo:** Janela de Contexto: `1.05M` (`1,048,576` tokens) | Saída Máxima: `65.5k` (`65,536` tokens)

---

## 1. As 3 Camadas de Limites no Antigravity (<Usado> / <Total>)

| Camada de Limite | Consumo Usado | Teto / Limite Total | Utilizado (%) | Margem Restante | Status & Ritmo |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Janela de Mensagem (Context)** | `125.8k` tokens | `1.05M` | **12.00%** | `922.7k` livres | Ativa na sessão |
| **2. Janela Móvel de 5 Horas (Rate)** | `570.1k` tokens | `800.0k` | **71.27%** | `229.9k` livres | 7 sessões (~114.0k/h) |
| **3. Janela Semanal (7 Dias Quota)** | `4.47M` tokens | `10.00M` | **44.67%** | `5.53M` livres | 59 sessões (~638.1k/dia) |

---

## 2. Distribuição de Consumo da Sessão Atual
| Categoria | Tokens Estimados | Bytes | Participação |
| :--- | :--- | :--- | :--- |
| **System Prompt & Schemas** | `35.8k` | 117,996 B | 28.4% |
| **Execuções de Ferramentas** | `70.8k` | 226,715 B | 56.3% |
| **Respostas & Thinking** | `17.8k` | 62,464 B | 14.2% |
| **Mensagens do Usuário** | `1.4k` | 5,542 B | 1.1% |

---

## 3. Top Ferramentas Consumidoras
| `GENERIC` | 211 | 61.6k | 197,187 B |
| `SYSTEM_MESSAGE` | 10 | 4.6k | 14,780 B |
| `EPHEMERAL_MESSAGE` | 17 | 4.6k | 14,748 B |

---

## 4. Recomendações de Governança
- **Janela de 5 Horas:** Consumo atual em **71.3%** do teto (229.9k disponíveis). Mantenha comandos e testes com saída concisa.
- **Janela Semanal:** Consumo atual em **44.7%** da cota semanal (5.53M disponíveis). Utilize `PROJECT_MEMORY.md` para resetar sessões longas ao concluir marcos.
