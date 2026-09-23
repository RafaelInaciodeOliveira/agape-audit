import mongoose, { Schema, Document } from 'mongoose';

// Log de cada requisição feita a um LLM (uma linha por chamada).
// totalCost é gravado na moeda de FINOPS_CURRENCY no momento da chamada.
// Para o agente da Umbler, o custo vem dos créditos realmente debitados (billable.deductedCredits)
// e os tokens são estimados (tokensEstimated = true), porque a Umbler não expõe a contagem real.
export interface IAiUsage extends Document {
  userId: string;
  userName?: string;
  modelName: string;
  promptTokens: number;
  completionTokens: number;
  totalCost: number;
  timestamp: Date;
  source: 'umbler' | 'direct';
  externalId?: string;
  chatId?: string;
  credits?: number;
  isAudio?: boolean;
  tokensEstimated: boolean;
}

const AiUsageSchema: Schema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    userName: { type: String },
    modelName: { type: String, required: true },
    promptTokens: { type: Number, required: true, min: 0, default: 0 },
    completionTokens: { type: Number, required: true, min: 0, default: 0 },
    totalCost: { type: Number, required: true, min: 0, default: 0 },
    timestamp: { type: Date, required: true, default: Date.now },
    source: { type: String, enum: ['umbler', 'direct'], default: 'direct' },
    // Id da mensagem na origem; garante que a sincronização não grave o mesmo consumo duas vezes
    externalId: { type: String },
    chatId: { type: String },
    credits: { type: Number, min: 0 },
    isAudio: { type: Boolean },
    tokensEstimated: { type: Boolean, default: false },
  },
  { collection: 'aiUsage' }
);

// As consultas do painel FinOps sempre filtram por período e agrupam por modelo
AiUsageSchema.index({ timestamp: -1 });
AiUsageSchema.index({ timestamp: 1, modelName: 1 });
AiUsageSchema.index({ source: 1, externalId: 1 }, { unique: true, partialFilterExpression: { externalId: { $type: 'string' } } });

export default (mongoose.models.AiUsage as mongoose.Model<IAiUsage>) || mongoose.model<IAiUsage>('AiUsage', AiUsageSchema);
