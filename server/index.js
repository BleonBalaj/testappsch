import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import schoolRoutes from './routes/schoolRoutes.js';
import invitationRoutes from './routes/invitationRoutes.js';

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/invitations', invitationRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', project: 'noesis-horizon-sch', timestamp: new Date().toISOString() });
});

import { fileURLToPath } from 'url';

// Only start standalone listener when executed directly (e.g. node server/index.js)
const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('server\\index.js') || 
  process.argv[1].endsWith('server/index.js') ||
  process.env.STANDALONE_SERVER === 'true'
);

if (isDirectRun) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server running on http://0.0.0.0:${PORT}`);
  });
}

export default app;
