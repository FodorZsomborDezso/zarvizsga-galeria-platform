const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cors());

// MySQL adatbázis kapcsolat
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'artisticeye',
});

// Táblák létrehozása
async function initializeDatabase() {
    try {
        const connection = await pool.getConnection();
        
        // Felhasználok tábla
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS felhasznalok (
                id INT PRIMARY KEY AUTO_INCREMENT,
                fnev VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                jelszo VARCHAR(255) NOT NULL,
                bio TEXT,
                pkep_url VARCHAR(500),
                keszul TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Feltöltések tábla
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS feltoltesek (
                id INT PRIMARY KEY AUTO_INCREMENT,
                felhasznalo_id INT,
                cim VARCHAR(200),
                leiras TEXT,
                kep_url VARCHAR(500) NOT NULL,
                tipus ENUM('image','short_video') NOT NULL,
                kategoria VARCHAR(50),
                keszul TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                szerkesztve TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (felhasznalo_id) REFERENCES felhasznalok(id) ON DELETE CASCADE
            )
        `);

        // Cimkék tábla
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS cimkek (
                id INT PRIMARY KEY AUTO_INCREMENT,
                nev VARCHAR(50) UNIQUE NOT NULL
            )
        `);

        // Feltöltés Cimkék tábla
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS feltoltes_cimkek (
                feltoltes_id INT NOT NULL,
                cimke_id INT NOT NULL,
                PRIMARY KEY (feltoltes_id, cimke_id),
                FOREIGN KEY (feltoltes_id) REFERENCES feltoltesek(id) ON DELETE CASCADE,
                FOREIGN KEY (cimke_id) REFERENCES cimkek(id) ON DELETE CASCADE
            )
        `);
        

        // felhasználó tábla
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS follows (
                koveto_id INT NOT NULL,
                kovetett_id INT NOT NULL,
                keszul TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (koveto_id, kovetett_id),
                FOREIGN KEY (koveto_id) REFERENCES felhasznalok(id) ON DELETE CASCADE,
                FOREIGN KEY (kovetett_id) REFERENCES felhasznalok(id) ON DELETE CASCADE
            )
        `);

        // feltoltes tábla
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS kommentek (
                id INT PRIMARY KEY AUTO_INCREMENT,
                felhasznalo_id INT,
                feltoltes_id INT,
                szoveg TEXT NOT NULL,
                keszul TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                szerkesztve TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (felhasznalo_id) REFERENCES felhasznalok(id) ON DELETE CASCADE,
                FOREIGN KEY (feltoltes_id) REFERENCES feltoltesek(id) ON DELETE CASCADE
            )
        `);

        // KiMitTud tábla (kapcsolótábla)
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS likeok (
                felhasznalo_id INT NOT NULL,
                feltoltes_id INT NOT NULL,
                keszul TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (felhasznalo_id, feltoltes_id),
                FOREIGN KEY (felhasznalo_id) REFERENCES felhasznalok(id) ON DELETE CASCADE,
                FOREIGN KEY (feltoltes_id) REFERENCES feltoltesek(id) ON DELETE CASCADE
            )
        `);

        connection.release();
        console.log('Adatbázis táblák létrehozva/ellenőrizve');
    } catch (err) {
        console.error('Hiba az adatbázis inicializálásakor:', err);
    }
}

// Felhasznalok CRUD műveletek
app.get('/api/felhasznalok', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM felhasznalok');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/felhasznalok/:id', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM felhasznalok WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Nincs ilyen felhasználó' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/felhasznalok', async (req, res) => {
    try {
        const { fnev, email, jelszo, bio, pkep_url } = req.body;
        const [result] = await pool.execute(
            'INSERT INTO felhasznalok (fnev, email, jelszo, bio, pkep_url) VALUES (?, ?, ?, ?, ?)',
            [fnev, email, jelszo, bio, pkep_url]
        );
        const [newRow] = await pool.execute('SELECT * FROM felhasznalok WHERE id = ?', [result.insertId]);
        res.json(newRow[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/felhasznalok/:id', async (req, res) => {
    try {
        const { fnev, email, jelszo, bio, pkep_url } = req.body;
        const [result] = await pool.execute(
            'UPDATE felhasznalok SET fnev = ?, email = ?, jelszo = ?, bio = ?, pkep_url = ? WHERE id = ?',
            [fnev, email, jelszo, bio, pkep_url, req.params.id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Nincs ilyen felhasználó' });
        const [updatedRow] = await pool.execute('SELECT * FROM felhasznalok WHERE id = ?', [req.params.id]);
        res.json(updatedRow[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.delete('/api/felhasznalok/:id', async (req, res) => {
    try {
        const [result] = await pool.execute('DELETE FROM felhasznalok WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Nincs ilyen felhasználó' });
        res.json({ message: 'Felhasználó törölve' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Feltöltések CRUD műveletek
app.get('/api/feltoltesek', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM feltoltesek');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/feltoltesek/:id', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM feltoltesek WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Nincs ilyen feltoltes' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/feltoltesek', async (req, res) => {
    try {
        const { felhasznalo_id, cim, leiras, kep_url, tipus, kategoria } = req.body;
        const [result] = await pool.execute(
            'INSERT INTO feltoltesek (felhasznalo_id, cim, leiras, kep_url, tipus, kategoria) VALUES (?, ?, ?, ?, ?, ?)',
            [felhasznalo_id, cim, leiras, kep_url, tipus, kategoria]
        );
        const [newRow] = await pool.execute('SELECT * FROM feltoltesek WHERE id = ?', [result.insertId]);
        res.json(newRow[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/feltoltesek/:id', async (req, res) => {
    try {
        const { felhasznalo_id, cim, leiras, kep_url, tipus, kategoria } = req.body;
        const [result] = await pool.execute(
            'UPDATE feltoltesek SET felhasznalo_id = ?, cim = ?, leiras = ?, kep_url = ?, tipus, kategoria WHERE id = ?',
            [felhasznalo_id, cim, leiras, kep_url, tipus, kategoria, req.params.id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Nincs ilyen feltoltes' });
        const [updatedRow] = await pool.execute('SELECT * FROM feltoltesek WHERE id = ?', [req.params.id]);
        res.json(updatedRow[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.delete('/api/feltoltesek/:id', async (req, res) => {
    try {
        const [result] = await pool.execute('DELETE FROM feltoltesek WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Nincs ilyen feltoltes' });
        res.json({ message: 'feltoltes törölve' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Cimkek CRUD műveletek
app.get('/api/cimkek', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM cimkek');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/cimkek/:id', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM cimkek WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Nincs ilyen cimke' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/cimkek', async (req, res) => {
    try {
        const { nev } = req.body;
        const [result] = await pool.execute(
            'INSERT INTO cimkek (nev) VALUES (?)',
            [nev]
        );
        const [newRow] = await pool.execute('SELECT * FROM cimkek WHERE id = ?', [result.insertId]);
        res.json(newRow[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/cimkek/:id', async (req, res) => {
    try {
        const { nev } = req.body;
        const [result] = await pool.execute(
            'UPDATE cimkek SET nev = ? WHERE id = ?',
            [nev, req.params.id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Nincs ilyen cimke' });
        const [updatedRow] = await pool.execute('SELECT * FROM cimkek WHERE id = ?', [req.params.id]);
        res.json(updatedRow[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.delete('/api/cimkek/:id', async (req, res) => {
    try {
        const [result] = await pool.execute('DELETE FROM cimkek WHERE id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Nincs ilyen cimke' });
        res.json({ message: 'Cimke törölve' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Kommentek CRUD műveletek
app.get('/api/kommentek', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM kommentek');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/kommentek/:id', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM kommentek WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Nincs ilyen komment' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/kommentek', async (req, res) => {
    try {
        const { szoveg } = req.body;
        const [result] = await pool.execute(
            'INSERT INTO kommentek (szoveg) VALUES (?)',
            [szoveg]
        );
        const [newRow] = await pool.execute('SELECT * FROM kommentek WHERE id = ?', [result.insertId]);
        res.json(newRow[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/kommentek/:id', async (req, res) => {
    try {
        const { szoveg } = req.body;
        const [result] = await pool.execute(
            'UPDATE kommentek SET szoveg = ? WHERE id = ?',
            [szoveg, req.params.id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Nincs ilyen komment' });
        const [updatedRow] = await pool.execute('SELECT * FROM kommentek WHERE id = ?', [req.params.id]);
        res.json(updatedRow[0]);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Szerver indítása
initializeDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`Szerver fut: http://localhost:${PORT}`);
    });
});