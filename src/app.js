import express, { json } from "express"
import cors from "cors"
import { MongoClient, ObjectId } from 'mongodb';
import Joi from "joi"
import dotenv from "dotenv"
import dayjs from "dayjs";

dotenv.config()

// configurando a api

const PORT = 5000
const app = express()
app.use(express.json())
app.use(cors())

// conectando o mongo

const mongoClient = new MongoClient(process.env.DATABASE_URL)
let db
mongoClient.connect()
    .then(()=> db = mongoClient.db())
    .catch((err)=> console.log(err))

// endpoints

app.post("/participantes", async (req, res)=>{
    const { name } = req.body
    const newParticipante = {
        name,
        lastStatus: Date.now()
    }
    const participanteSchema = Joi.object({
        name: Joi.string().required(),
    })
    const validation = participanteSchema.validate(newParticipante, {abortEarly: false});
    if(validation.error){
        const erros = validation.error.details.map((detail)=> detail.message)
        return res.status(422).send(erros)
    }
    try{
        const participante = await db.collections("participants").findOne({name: name})
        if(participante) return res.status(409).send("Este nome já está em uso")
        await db.collections("participants").insertOne(newParticipante)
        const time = dayjs(newParticipante.lastStatus).format("HH:mm:ss")
        const message = {
            from: name,
            to: "Todos",
            text: "entra na sala...",
            type: "status",
            time: time
        }
        await db.collections("messages").insertOne(message)
        res.send(201)
    }catch(err){
        res.status(500).send(err.message)
    }
})

app.get("/participantes", async (req, res)=>{
    try{
        const participantes = await db.collections("participants").find().toArray()
        res.send(participantes)
    }catch(err){
        res.status(500).send(err.message)
    }
})

// conectando o servidor     

app.listen(PORT, ()=> console.log(`O servidor está rodando na porta: ${PORT}`))