# 📊 Relatório de Telemetria de Tokens — Antigravity
> **Status:** 🟡 Atenção (>50%) | **Última Leitura:** 2026-09-26 20:48:53  
> **Sessão:** `803890b3-c25a-4657-b491-3a9d66e4b030` | **Modelo Utilizado:** `Gemini 3.8 Flash` (`gemini-3.8-flash`) | **Effort:** `Medium`  
> **Limites do Modelo:** Janela de Contexto: `1.05M` (`1,048,576` tokens) | Saída Máxima: `65.5k` (`65,536` tokens)

---

## 1. As 3 Camadas de Limites no Antigravity (<Usado> / <Total>)

| Camada de Limite | Consumo Usado | Teto / Limite Total | Utilizado (%) | Margem Restante | Status & Ritmo |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Janela de Mensagem (Context)** | `77.7k` tokens | `1.05M` | **7.41%** | `970.9k` livres | Ativa na sessão |
| **2. Janela Móvel de 5 Horas (Rate)** | `611.8k` tokens | `800.0k` | **76.48%** | `188.2k` livres | 6 sessões (~122.4k/h) |
| **3. Janela Semanal (7 Dias Quota)** | `4.69M` tokens | `10.00M` | **46.94%** | `5.31M` livres | 60 sessões (~670.6k/dia) |

---

## 2. Distribuição de Consumo da Sessão Atual
| Categoria | Tokens Estimados | Bytes | Participação |
| :--- | :--- | :--- | :--- |
| **System Prompt & Schemas** | `35.8k` | 117,996 B | 46.0% |
| **Execuções de Ferramentas** | `33.9k` | 108,432 B | 43.6% |
| **Respostas & Thinking** | `7.5k` | 26,191 B | 9.6% |
| **Mensagens do Usuário** | `601` | 2,405 B | 0.8% |

---

## 3. Top Ferramentas Consumidoras
| `GENERIC` | 87 | 27.8k | 89,097 B |
| `SYSTEM_MESSAGE` | 8 | 3.6k | 11,565 B |
| `EPHEMERAL_MESSAGE` | 9 | 2.4k | 7,770 B |

---

## 4. Recomendações de Governança
- **Janela de 5 Horas:** Consumo atual em **76.5%** do teto (188.2k disponíveis). Mantenha comandos e testes com saída concisa.
- **Janela Semanal:** Consumo atual em **46.9%** da cota semanal (5.31M disponíveis). Utilize `PROJECT_MEMORY.md` para resetar sessões longas ao concluir marcos.
