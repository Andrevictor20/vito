# 📊 Relatório de Telemetria de Tokens — Antigravity
> **Status:** 🟡 Atenção (>50%) | **Última Leitura:** 2026-09-26 18:38:14  
> **Sessão:** `ba5a0bef-eb18-43cc-a06d-c7ac404202d0` | **Modelo Utilizado:** `Gemini 3.8 Flash` (`gemini-3.8-flash`) | **Effort:** `Medium`  
> **Limites do Modelo:** Janela de Contexto: `1.05M` (`1,048,576` tokens) | Saída Máxima: `65.5k` (`65,536` tokens)

---

## 1. As 3 Camadas de Limites no Antigravity (<Usado> / <Total>)

| Camada de Limite | Consumo Usado | Teto / Limite Total | Utilizado (%) | Margem Restante | Status & Ritmo |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Janela de Mensagem (Context)** | `114.4k` tokens | `1.05M` | **10.91%** | `934.2k` livres | Ativa na sessão |
| **2. Janela Móvel de 5 Horas (Rate)** | `558.7k` tokens | `800.0k` | **69.84%** | `241.3k` livres | 7 sessões (~111.7k/h) |
| **3. Janela Semanal (7 Dias Quota)** | `4.46M` tokens | `10.00M` | **44.55%** | `5.54M` livres | 59 sessões (~636.5k/dia) |

---

## 2. Distribuição de Consumo da Sessão Atual
| Categoria | Tokens Estimados | Bytes | Participação |
| :--- | :--- | :--- | :--- |
| **System Prompt & Schemas** | `35.8k` | 117,996 B | 31.3% |
| **Execuções de Ferramentas** | `62.2k` | 198,918 B | 54.3% |
| **Respostas & Thinking** | `15.2k` | 53,276 B | 13.3% |
| **Mensagens do Usuário** | `1.2k` | 4,951 B | 1.1% |

---

## 3. Top Ferramentas Consumidoras
| `GENERIC` | 189 | 55.3k | 176,979 B |
| `EPHEMERAL_MESSAGE` | 15 | 4.1k | 12,973 B |
| `SYSTEM_MESSAGE` | 6 | 2.8k | 8,966 B |

---

## 4. Recomendações de Governança
- **Janela de 5 Horas:** Consumo atual em **69.8%** do teto (241.3k disponíveis). Mantenha comandos e testes com saída concisa.
- **Janela Semanal:** Consumo atual em **44.6%** da cota semanal (5.54M disponíveis). Utilize `PROJECT_MEMORY.md` para resetar sessões longas ao concluir marcos.
