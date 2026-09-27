# 📊 Relatório de Telemetria de Tokens — Antigravity
> **Status:** 🔴 Crítico (>80%) | **Última Leitura:** 2026-09-26 21:57:07  
> **Sessão:** `803890b3-c25a-4657-b491-3a9d66e4b030` | **Modelo Utilizado:** `Gemini 3.8 Flash` (`gemini-3.8-flash`) | **Effort:** `Medium`  
> **Limites do Modelo:** Janela de Contexto: `1.05M` (`1,048,576` tokens) | Saída Máxima: `65.5k` (`65,536` tokens)

---

## 1. As 3 Camadas de Limites no Antigravity (<Usado> / <Total>)

| Camada de Limite | Consumo Usado | Teto / Limite Total | Utilizado (%) | Margem Restante | Status & Ritmo |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Janela de Mensagem (Context)** | `220.6k` tokens | `1.05M` | **21.04%** | `828.0k` livres | Ativa na sessão |
| **2. Janela Móvel de 5 Horas (Rate)** | `754.8k` tokens | `800.0k` | **94.35%** | `45.2k` livres | 6 sessões (~151.0k/h) |
| **3. Janela Semanal (7 Dias Quota)** | `4.84M` tokens | `10.00M` | **48.37%** | `5.16M` livres | 60 sessões (~691.0k/dia) |

---

## 2. Distribuição de Consumo da Sessão Atual
| Categoria | Tokens Estimados | Bytes | Participação |
| :--- | :--- | :--- | :--- |
| **System Prompt & Schemas** | `35.8k` | 117,996 B | 16.2% |
| **Execuções de Ferramentas** | `157.5k` | 504,031 B | 71.4% |
| **Respostas & Thinking** | `24.9k` | 87,079 B | 11.3% |
| **Mensagens do Usuário** | `2.5k` | 9,909 B | 1.1% |

---

## 3. Top Ferramentas Consumidoras
| `GENERIC` | 358 | 142.3k | 455,325 B |
| `SYSTEM_MESSAGE` | 14 | 8.2k | 26,143 B |
| `EPHEMERAL_MESSAGE` | 26 | 7.0k | 22,563 B |

---

## 4. Recomendações de Governança
- **Janela de 5 Horas:** Consumo atual em **94.4%** do teto (45.2k disponíveis). Mantenha comandos e testes com saída concisa.
- **Janela Semanal:** Consumo atual em **48.4%** da cota semanal (5.16M disponíveis). Utilize `PROJECT_MEMORY.md` para resetar sessões longas ao concluir marcos.
