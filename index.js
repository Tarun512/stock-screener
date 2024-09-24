// const axios = require('axios');
import axios from "axios";
import express from "express";
import pg from "pg";
import dotenv from 'dotenv';

const app = express();
const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "stocks",
  password: "12345",
  port: 5432,
})
dotenv.config();
db.connect();
const instrument = "NSE_EQ|INE040A01034,NSE_EQ|INE090A01021,NSE_EQ|INE062A01020,NSE_EQ|INE237A01028,NSE_EQ|INE238A01034,NSE_EQ|INE002A01018,NSE_EQ|INE009A01021,NSE_EQ|INE154A01025,NSE_EQ|INE018A01030,NSE_EQ|INE467B01029,NSE_EQ|INE397D01024"
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PORT = process.env.PORT;

export const fetchData = async()=>{
  try {
    const response = await axios.get(`https://api.upstox.com/v2/market-quote/ohlc`,
      {headers:{
        "Authorization": `Bearer ${ACCESS_TOKEN}`,
        "Accept": "application/json"
      },params:{
        "instrument_key": `${instrument}`,
        "interval": "1d"
      }})
    
     
    const dataObject = response.data.data
    const sortedkeys=Object.keys(dataObject).sort()
    const sortedDataObject = {};
    sortedkeys.forEach(key => {
    sortedDataObject[key] = dataObject[key];
    // console.log(sortedDataObject);
  });
    return sortedDataObject

  }catch (error) {
    return error.message
  }
}
// await fetchData();
const queriedData = async ()=>{
  const data = await fetchData();
  const sortedkeys=Object.keys(data)
  // console.log(sortedkeys);
  try {
      sortedkeys.forEach(async(key) =>{
        // console.log(key);
        await db.query(`UPDATE index SET prevclose = curclose,curclose = $2::numeric + 1,bnv = CASE WHEN curclose > prevclose THEN 1 WHEN curclose  < prevclose THEN -1 WHEN curclose = prevclose THEN 0 END,nv = CASE WHEN curclose > prevclose THEN 1 WHEN curclose  < prevclose THEN -1 WHEN curclose = prevclose THEN 0 END, bnt = bnv * bnw, nt = nv * nw WHERE stock = $1;`, [key, parseFloat(data[key].ohlc.close)]);
      })     
     }
    catch (error) {
    console.log("error from queriedData block",error)
  }
}
// await queriedData();
let bnArray = new Array(376);
let nArray = new Array(376);
const eligibleStock = async ()=>{
  const i = new Date().getHours() * 60 + new Date().getMinutes() - 555;
  await queriedData();
  try {
    bnArray[i] = (await db.query("SELECT SUM(bnt) from index")).rows[0].sum;
    nArray[i] = (await db.query("SELECT SUM(nt) from index")).rows[0].sum;
    const json = [{bnt: bnArray[i]},{nt: nArray[i]},{i}];
    // console.log(json);
    return json;
  } catch (error) {
    console.log("error from eligibleStock",error)
  }
}

// app.get("/",async(req,res)=>{
//   try {
//     const data = await queriedData();
//     res.json(data)
//   } catch (error) {
//     res.status(500).json({message: "Error fetching data",error: error.message})
//   }
// })

const chat_id = process.env.CHAT_ID;
const sendData = async()=>{
  const data1 = await eligibleStock();
  const data = JSON.stringify(data1);
  console.log(data);
  if(data){
    await axios.post(`https://api.telegram.org/${process.env.TELEGRAM_TOKEN}/sendMessage`,null,
      {headers:{
        "Accept": "application/json"
      },params:{
        "chat_id": `${chat_id}`,
        "text": `${data}`,
      }}
    ).then(response => {console.log("Message sent successfully",response.data)})
    .catch(error=> {console.log("Error when sending message",error)}) 
  }else{
    console.log("message text is empty");
  }  
}
const port = PORT 
app.listen(port,async()=>{
  setInterval(async()=>{
    await sendData();
  },60000);
  
  console.log("App listening at port 5500")
});

export default app