# 📊 Relatório de Telemetria de Tokens — Antigravity
> **Status:** 🟡 Atenção (>50%) | **Última Leitura:** 2026-09-26 18:21:58  
> **Sessão:** `ba5a0bef-eb18-43cc-a06d-c7ac404202d0` | **Modelo Utilizado:** `Gemini 3.8 Flash` (`gemini-3.8-flash`) | **Effort:** `Medium`  
> **Limites do Modelo:** Janela de Contexto: `1.05M` (`1,048,576` tokens) | Saída Máxima: `65.5k` (`65,536` tokens)

---

## 1. As 3 Camadas de Limites no Antigravity (<Usado> / <Total>)

| Camada de Limite | Consumo Usado | Teto / Limite Total | Utilizado (%) | Margem Restante | Status & Ritmo |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Janela de Mensagem (Context)** | `89.5k` tokens | `1.05M` | **8.54%** | `959.0k` livres | Ativa na sessão |
| **2. Janela Móvel de 5 Horas (Rate)** | `534.3k` tokens | `800.0k` | **66.79%** | `265.7k` livres | 7 sessões (~106.9k/h) |
| **3. Janela Semanal (7 Dias Quota)** | `4.43M` tokens | `10.00M` | **44.31%** | `5.57M` livres | 59 sessões (~633.0k/dia) |

---

## 2. Distribuição de Consumo da Sessão Atual
| Categoria | Tokens Estimados | Bytes | Participação |
| :--- | :--- | :--- | :--- |
| **System Prompt & Schemas** | `35.3k` | 116,589 B | 39.5% |
| **Execuções de Ferramentas** | `40.9k` | 130,890 B | 45.7% |
| **Respostas & Thinking** | `12.2k` | 42,738 B | 13.6% |
| **Mensagens do Usuário** | `1.1k` | 4,376 B | 1.2% |

---

## 3. Top Ferramentas Consumidoras
| `GENERIC` | 103 | 37.4k | 119,700 B |
| `EPHEMERAL_MESSAGE` | 13 | 3.5k | 11,190 B |

---

## 4. Recomendações de Governança
- **Janela de 5 Horas:** Consumo atual em **66.8%** do teto (265.7k disponíveis). Mantenha comandos e testes com saída concisa.
- **Janela Semanal:** Consumo atual em **44.3%** da cota semanal (5.57M disponíveis). Utilize `PROJECT_MEMORY.md` para resetar sessões longas ao concluir marcos.
