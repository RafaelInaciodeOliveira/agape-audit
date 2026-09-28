import mongoose, { Schema } from 'mongoose';

// Atendente exibido no filtro da lista de chats. `memberId` é o id do membro na Umbler.
export interface IAttendant {
  memberId: string;
  name: string;
  order: number;
  active: boolean;
}

const AttendantSchema = new Schema<IAttendant>(
  {
    memberId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'attendants' }
);

export default (mongoose.models.Attendant as mongoose.Model<IAttendant>) || mongoose.model<IAttendant>('Attendant', AttendantSchema);
