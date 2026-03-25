from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.inventory import router as inventory_router
from routers import catalog, cart, inventory 

app = FastAPI()

# Add CORS middleware
#Allow frontend (Next.js) to call the backend (FastAPI) from the browser
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  #Allow all origins
    allow_credentials=True,
    allow_methods=["*"],  #Allow all methods
    allow_headers=["*"],  #Allow all headers
)

app.include_router(catalog.router)
app.include_router(cart.router)

#Include the inventory router
app.include_router(inventory_router)

@app.get("/health")
def health():
    return {"status": "ok"}
