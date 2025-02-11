require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const port = process.env.PORT || 3000;

// Configuración de conexión a PostgreSQL
const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
});

app.use(cors());
app.use(express.json());

// Endpoint para obtener todos los incendios con filtros opcionales
app.get("/api/incendios", async (req, res) => {
  try {
    const { provincia, severidad } = req.query;
    let query = `
            SELECT id, provincia, fecha_inicio, fecha_fin, ha_afectada, severidad, 
                   ST_AsGeoJSON(geom)::json AS geometry
            FROM incendios
            WHERE 1=1`;
    const values = [];

    if (provincia) {
      values.push(provincia);
      query += ` AND provincia = $${values.length}`;
    }

    if (severidad) {
      values.push(severidad);
      query += ` AND severidad = $${values.length}`;
    }

    const result = await pool.query(query, values);
    res.json({
      type: "FeatureCollection",
      features: result.rows.map((row) => ({
        type: "Feature",
        geometry: row.geometry,
        properties: {
          id: row.id,
          provincia: row.provincia,
          fecha_inicio: row.fecha_inicio,
          fecha_fin: row.fecha_fin,
          ha_afectada: row.ha_afectada,
          severidad: row.severidad,
        },
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener los incendios" });
  }
});

// Endpoint para agregar un nuevo incendio
app.post("/api/incendios", async (req, res) => {
  try {
    const {
      provincia,
      fecha_inicio,
      fecha_fin,
      ha_afectada,
      severidad,
      lat,
      long,
    } = req.body;
    const query = `
            INSERT INTO incendios (provincia, fecha_inicio, fecha_fin, ha_afectada, severidad, geom)
            VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326))
            RETURNING *;`;

    const values = [
      provincia,
      fecha_inicio,
      fecha_fin,
      ha_afectada,
      severidad,
      long,
      lat,
    ];
    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al agregar el incendio" });
  }
});

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});

app.get("/", (req, res) => {
  res.send(
    "Bienvenido a la API de Incendios Forestales. Usa /api/incendios para ver los datos."
  );
});
