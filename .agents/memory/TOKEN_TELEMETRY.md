# 📊 Relatório de Telemetria de Tokens — Antigravity
> **Status:** 🟡 Atenção (>50%) | **Última Leitura:** 2026-09-27 15:11:18  
> **Sessão:** `584bcc98-650d-4cce-b585-ea6c883c2ed7` | **Modelo Utilizado:** `Gemini 3.8 Flash` (`gemini-3.8-flash`) | **Effort:** `Medium`  
> **Limites do Modelo:** Janela de Contexto: `1.05M` (`1,048,576` tokens) | Saída Máxima: `65.5k` (`65,536` tokens)

---

## 1. As 3 Camadas de Limites no Antigravity (<Usado> / <Total>)

| Camada de Limite | Consumo Usado | Teto / Limite Total | Utilizado (%) | Margem Restante | Status & Ritmo |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Janela de Mensagem (Context)** | `228.5k` tokens | `1.05M` | **21.79%** | `820.1k` livres | Ativa na sessão |
| **2. Janela Móvel de 5 Horas (Rate)** | `288.0k` tokens | `800.0k` | **36.00%** | `512.0k` livres | 3 sessões (~57.6k/h) |
| **3. Janela Semanal (7 Dias Quota)** | `5.28M` tokens | `10.00M` | **52.84%** | `4.72M` livres | 64 sessões (~754.8k/dia) |

---

## 2. Distribuição de Consumo da Sessão Atual
| Categoria | Tokens Estimados | Bytes | Participação |
| :--- | :--- | :--- | :--- |
| **System Prompt & Schemas** | `35.8k` | 117,996 B | 15.7% |
| **Execuções de Ferramentas** | `174.0k` | 556,810 B | 76.2% |
| **Respostas & Thinking** | `16.6k` | 57,993 B | 7.3% |
| **Mensagens do Usuário** | `2.1k` | 8,553 B | 0.9% |

---

## 3. Top Ferramentas Consumidoras
| `GENERIC` | 305 | 169.2k | 541,305 B |
| `EPHEMERAL_MESSAGE` | 17 | 4.7k | 14,937 B |
| `SYSTEM_MESSAGE` | 1 | 177 | 568 B |

---

## 4. Recomendações de Governança
- **Janela de 5 Horas:** Consumo atual em **36.0%** do teto (512.0k disponíveis). Mantenha comandos e testes com saída concisa.
- **Janela Semanal:** Consumo atual em **52.8%** da cota semanal (4.72M disponíveis). Utilize `PROJECT_MEMORY.md` para resetar sessões longas ao concluir marcos.
