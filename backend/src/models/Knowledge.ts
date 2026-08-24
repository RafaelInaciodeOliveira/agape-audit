import mongoose, { Schema, Document } from 'mongoose';

export interface IKnowledge extends Document {
  module: string;
  section: string;
  title: string;
  content: string;
  source: 'upload_txt' | 'auditoria' | 'manual';
  createdAt: Date;
  updatedAt: Date;
}

const KnowledgeSchema: Schema = new Schema(
  {
    module: { type: String, default: 'Módulo Geral' },
    section: { type: String, default: 'Geral' },
    title: { type: String, required: true },
    content: { type: String, required: true },
    source: { type: String, enum: ['upload_txt', 'auditoria', 'manual'], default: 'upload_txt' },
  },
  { timestamps: true }
);

export default mongoose.models.Knowledge || mongoose.model<IKnowledge>('Knowledge', KnowledgeSchema);