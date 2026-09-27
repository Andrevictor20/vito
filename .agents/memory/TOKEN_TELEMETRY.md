# 📊 Relatório de Telemetria de Tokens — Antigravity
> **Status:** 🟡 Atenção (>50%) | **Última Leitura:** 2026-09-27 12:30:02  
> **Sessão:** `584bcc98-650d-4cce-b585-ea6c883c2ed7` | **Modelo Utilizado:** `Gemini 3.8 Flash` (`gemini-3.8-flash`) | **Effort:** `Medium`  
> **Limites do Modelo:** Janela de Contexto: `1.05M` (`1,048,576` tokens) | Saída Máxima: `65.5k` (`65,536` tokens)

---

## 1. As 3 Camadas de Limites no Antigravity (<Usado> / <Total>)

| Camada de Limite | Consumo Usado | Teto / Limite Total | Utilizado (%) | Margem Restante | Status & Ritmo |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Janela de Mensagem (Context)** | `101.3k` tokens | `1.05M` | **9.66%** | `947.3k` livres | Ativa na sessão |
| **2. Janela Móvel de 5 Horas (Rate)** | `160.7k` tokens | `800.0k` | **20.09%** | `639.3k` livres | 3 sessões (~32.1k/h) |
| **3. Janela Semanal (7 Dias Quota)** | `5.16M` tokens | `10.00M` | **51.56%** | `4.84M` livres | 64 sessões (~736.6k/dia) |

---

## 2. Distribuição de Consumo da Sessão Atual
| Categoria | Tokens Estimados | Bytes | Participação |
| :--- | :--- | :--- | :--- |
| **System Prompt & Schemas** | `35.8k` | 117,996 B | 35.3% |
| **Execuções de Ferramentas** | `58.4k` | 186,924 B | 57.7% |
| **Respostas & Thinking** | `6.6k` | 23,027 B | 6.5% |
| **Mensagens do Usuário** | `525` | 2,101 B | 0.5% |

---

## 3. Top Ferramentas Consumidoras
| `GENERIC` | 121 | 56.0k | 179,324 B |
| `EPHEMERAL_MESSAGE` | 8 | 2.2k | 7,032 B |
| `SYSTEM_MESSAGE` | 1 | 177 | 568 B |

---

## 4. Recomendações de Governança
- **Janela de 5 Horas:** Consumo atual em **20.1%** do teto (639.3k disponíveis). Mantenha comandos e testes com saída concisa.
- **Janela Semanal:** Consumo atual em **51.6%** da cota semanal (4.84M disponíveis). Utilize `PROJECT_MEMORY.md` para resetar sessões longas ao concluir marcos.
