# 📊 Relatório de Telemetria de Tokens — Antigravity
> **Status:** 🔴 Crítico (>80%) | **Última Leitura:** 2026-10-02 00:15:01  
> **Sessão:** `a99aa32f-614a-43ea-9ab4-2bc9ad6e00af` | **Modelo Utilizado:** `Gemini 3.8 Flash` (`gemini-3.8-flash`) | **Effort:** `High`  
> **Limites do Modelo:** Janela de Contexto: `1.05M` (`1,048,576` tokens) | Saída Máxima: `65.5k` (`65,536` tokens)

---

## 1. As 3 Camadas de Limites no Antigravity (<Usado> / <Total>)

| Camada de Limite | Consumo Usado | Teto / Limite Total | Utilizado (%) | Margem Restante | Status & Ritmo |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Janela de Mensagem (Context)** | `250.7k` tokens | `1.05M` | **23.91%** | `797.9k` livres | Ativa na sessão |
| **2. Janela Móvel de 5 Horas (Rate)** | `741.7k` tokens | `800.0k` | **92.71%** | `58.3k` livres | 7 sessões (~148.3k/h) |
| **3. Janela Semanal (7 Dias Quota)** | `4.55M` tokens | `10.00M` | **45.55%** | `5.45M` livres | 54 sessões (~650.7k/dia) |

---

## 2. Distribuição de Consumo da Sessão Atual
| Categoria | Tokens Estimados | Bytes | Participação |
| :--- | :--- | :--- | :--- |
| **System Prompt & Schemas** | `36.1k` | 119,253 B | 14.4% |
| **Execuções de Ferramentas** | `193.0k` | 617,500 B | 77.0% |
| **Respostas & Thinking** | `18.8k` | 65,970 B | 7.5% |
| **Mensagens do Usuário** | `2.7k` | 10,848 B | 1.1% |

---

## 3. Top Ferramentas Consumidoras
| `VIEW_FILE` | 158 | 124.6k | 398,758 B |
| `CODE_ACTION` | 48 | 36.6k | 117,045 B |
| `RUN_COMMAND` | 57 | 13.0k | 41,622 B |
| `SYSTEM_MESSAGE` | 25 | 11.4k | 36,594 B |
| `SEARCH_WEB` | 4 | 4.1k | 13,011 B |
| `GREP_SEARCH` | 3 | 1.4k | 4,450 B |
| `LIST_DIRECTORY` | 10 | 932 | 2,983 B |
| `ERROR_MESSAGE` | 7 | 900 | 2,880 B |
| `ASK_QUESTION` | 1 | 49 | 157 B |

---

## ⚡ Economia de Tokens via RTK (Rust Token Killer)
- **Comandos interceptados:** 174
- **Tokens economizados:** `34.5k` (34,492 tokens)
- **Taxa média de redução:** **49.1%**

---

## 4. Recomendações de Governança
- **Janela de 5 Horas:** Consumo atual em **92.7%** do teto (58.3k disponíveis). Mantenha comandos e testes com saída concisa.
- **Janela Semanal:** Consumo atual em **45.5%** da cota semanal (5.45M disponíveis). Utilize `PROJECT_MEMORY.md` para resetar sessões longas ao concluir marcos.
