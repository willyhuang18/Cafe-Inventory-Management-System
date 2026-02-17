import expresss from "express";
import listingRouter from "./routes/listings.js";

console.log("Initializing the backend...");

const app = expresss();
const PORT = process.env.PORT || 3000;

app.use(expresss.static("./public"));
app.use("/api", listingRouter);

app.listen(PORT, () => {
  console.log(`Server is running on localhost:${PORT}`);
});
