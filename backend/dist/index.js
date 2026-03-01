"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const database_1 = require("./db/database");
const notes_1 = __importDefault(require("./routes/notes"));
const voice_1 = __importDefault(require("./routes/voice"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5586;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use('/api', notes_1.default);
app.use('/api', voice_1.default);
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});
app.use((err, _req, res, _next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});
if (require.main === module) {
    (0, database_1.initializeDatabase)()
        .then(() => {
        console.log('📦 Database initialized');
        app.listen(PORT, () => {
            console.log(`🚀 Knowledge Base API running on port ${PORT}`);
        });
    })
        .catch((err) => {
        console.error('Failed to initialize database:', err);
        process.exit(1);
    });
}
exports.default = app;
//# sourceMappingURL=index.js.map