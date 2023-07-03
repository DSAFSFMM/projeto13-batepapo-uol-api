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

app.post("/participants", async (req, res)=>{
    const { name } = req.body
    const newParticipante = {
        name,
        lastStatus: Date.now()
    }
    const participanteSchema = Joi.object({
        name: Joi.string().required(),
        lastStatus: Joi.any()
    })
    const validation = participanteSchema.validate(newParticipante, {abortEarly: false});
    if(validation.error){
        const erros = validation.error.details.map((detail)=> detail.message)
        return res.status(422).send(erros)
    }
    try{
        const participante = await db.collection("participants").findOne({name: name})
        if(participante) return res.status(409).send("Este nome já está em uso")
        await db.collection("participants").insertOne(newParticipante)
        const time = dayjs(newParticipante.lastStatus).format("HH:mm:ss")
        const message = {
            from: name,
            to: "Todos",
            text: "entra na sala...",
            type: "status",
            time: time
        }
        await db.collection("messages").insertOne(message)
        res.sendStatus(201)
    }catch(err){
        res.status(500).send(err.message)
    }
})

app.get("/participants", async (req, res)=>{
    try{
        const participantes = await db.collection("participants").find().toArray()
        res.send(participantes)
    }catch(err){
        res.status(500).send(err.message)
    }
})

app.post("/messages", async (req, res)=>{
    const {to, text, type} = req.body
    const user = req.headers.user
    const messageSchema = Joi.object({
        to: Joi.string().required(),
        text: Joi.string().required(),
        type: Joi.any().valid("message", "private_message").required(),
    })
    const validation = messageSchema.validate({to, text, type}, {abortEarly: false})
    if(validation.error){
        const err = validation.error.details.map((detail)=> detail.message)
        return res.status(422).send(err)
    }
    try {
        const userValidation = await db.collection("participants").findOne({name: user})
        if(!userValidation) return res.status(422).send("Usuario invalido")
        const newMessage = {
            to,
            text,
            type,
            from: user,
            time: dayjs().format("HH:mm:ss")
        }
        await db.collection("messages").insertOne(newMessage)
        res.sendStatus(201)
    } catch (err) {
        res.status(500).send(err.message)
    }
})


// mongodb://localhost:5000/messages?limit=100
app.get("/messages", async (req, res)=>{
    const limit = Number(req.query.limit)
    const user = req.headers.user
    if(req.query.limit && (isNaN(limit) || limit < 1)){
        return res.status(422).send("limite inválido")
    }
    try {
        const messages = await db.collection("messages").find({ $or: [{to: "Todos"}, {to: user}, {from: user}]}).toArray()
        if(req.query.limit){
            return res.send(messages.slice(-limit).reverse())
        }
        res.send(messages)
    } catch (err) {
        res.status(500).send(err.message)
    }
})

app.post("/status", async (req,res)=>{
    const user = req.headers.user
    if(!user) return res.sendStatus(404)
    try{
        const participante = await db.collection("participants").findOne({name: user})
        if(!participante) return res.sendStatus(404)
        await db.collection("participants").updateOne({name: user}, {$set: {lastStatus: Date.now()}})
        res.send()
    }catch(err){
        return res.status(500).send(err.message)
    }
})

// remocao automatica

setInterval(async()=>{
    try{
        const tempoLimite = Date.now() - 10000
        const inativos = await db.collection("participants").find({lastStatus: {$lt: tempoLimite}}).toArray()
        await db.collection("participants").deleteMany({lastStatus: {$lt: tempoLimite}})
        inativos.forEach(async(user) => {
            const message = {
            from: user.name,
            to: "Todos",
            text: "sai da sala...",
            type: "status",
            time: dayjs().format("HH:mm:ss")
            }
            try{
                await db.collection("messages").insertOne(message)
            }catch(err){
                console.log(err.message)
            }
        })
    }catch(err){
        console.log(err.message)
    }
}, 15000)

// conectando o servidor     

app.listen(PORT, ()=> console.log(`O servidor está rodando na porta: ${PORT}`))