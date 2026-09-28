import mongoose, { Schema } from 'mongoose';

// Carteira de clientes. Um chat pertence à carteira cujo nome aparece em alguma das
// suas etiquetas na Umbler (ex.: etiqueta "Carteira ANTARES" → ANTARES).
export interface ICarteira {
  name: string;
  order: number;
  active: boolean;
}

const CarteiraSchema = new Schema<ICarteira>(
  {
    name: { type: String, required: true, unique: true, trim: true, uppercase: true },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'carteiras' }
);

export default (mongoose.models.Carteira as mongoose.Model<ICarteira>) || mongoose.model<ICarteira>('Carteira', CarteiraSchema);
