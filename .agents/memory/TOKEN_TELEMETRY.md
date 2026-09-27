# 📊 Relatório de Telemetria de Tokens — Antigravity
> **Status:** 🟡 Atenção (>50%) | **Última Leitura:** 2026-09-27 12:11:20  
> **Sessão:** `584bcc98-650d-4cce-b585-ea6c883c2ed7` | **Modelo Utilizado:** `Gemini 3.8 Flash` (`gemini-3.8-flash`) | **Effort:** `Medium`  
> **Limites do Modelo:** Janela de Contexto: `1.05M` (`1,048,576` tokens) | Saída Máxima: `65.5k` (`65,536` tokens)

---

## 1. As 3 Camadas de Limites no Antigravity (<Usado> / <Total>)

| Camada de Limite | Consumo Usado | Teto / Limite Total | Utilizado (%) | Margem Restante | Status & Ritmo |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Janela de Mensagem (Context)** | `64.2k` tokens | `1.05M` | **6.12%** | `984.4k` livres | Ativa na sessão |
| **2. Janela Móvel de 5 Horas (Rate)** | `123.6k` tokens | `800.0k` | **15.46%** | `676.4k` livres | 3 sessões (~24.7k/h) |
| **3. Janela Semanal (7 Dias Quota)** | `5.12M` tokens | `10.00M` | **51.19%** | `4.88M` livres | 64 sessões (~731.3k/dia) |

---

## 2. Distribuição de Consumo da Sessão Atual
| Categoria | Tokens Estimados | Bytes | Participação |
| :--- | :--- | :--- | :--- |
| **System Prompt & Schemas** | `35.8k` | 117,996 B | 55.7% |
| **Execuções de Ferramentas** | `26.5k` | 84,911 B | 41.4% |
| **Respostas & Thinking** | `1.7k` | 5,842 B | 2.6% |
| **Mensagens do Usuário** | `209` | 837 B | 0.3% |

---

## 3. Top Ferramentas Consumidoras
| `GENERIC` | 55 | 25.6k | 81,766 B |
| `EPHEMERAL_MESSAGE` | 3 | 805 | 2,577 B |
| `SYSTEM_MESSAGE` | 1 | 177 | 568 B |

---

## 4. Recomendações de Governança
- **Janela de 5 Horas:** Consumo atual em **15.5%** do teto (676.4k disponíveis). Mantenha comandos e testes com saída concisa.
- **Janela Semanal:** Consumo atual em **51.2%** da cota semanal (4.88M disponíveis). Utilize `PROJECT_MEMORY.md` para resetar sessões longas ao concluir marcos.
