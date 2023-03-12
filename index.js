import express from 'express';
import {v4 as uuid} from 'uuid';
import cors from 'cors';
import {create} from 'express-handlebars';
import fileUpload from 'express-fileupload';
import fs from 'fs';
import moment from 'moment';
moment().format();


import * as path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.listen(3000, () => console.log("http://localhost:3000"));

//MIDDLEWARE
app.use(express.json());
app.use(express.urlencoded({extended: false}))
app.use(fileUpload({
    limits: { fileSize: 5 * 1024 * 1024 },
    abortOnLimit: true,
    responseOnLimit: "La imágen que está subiendo sobrepasa los 5mb permitidos."
}));

  app.use(cors());
  app.use('/public', express.static('public'))

//configuracion de handlebars

const hbs = create({
	partialsDir: [
		"views/partials/",
	],
});

app.engine("handlebars", hbs.engine);
app.set("view engine", "handlebars");
app.set("views", path.resolve(__dirname, "./views"));

//FUNCIONES
const leerProductos = () => {
    return new Promise((resolve, reject) => {
        fs.readFile("productos.json", "utf8", (error, data) => {
            if(error) return reject("Ha ocurrido un error al cargar los productos.");
            let productos = JSON.parse(data)
            resolve(productos)
        })
    })
}

const leerProductosPorId = (id) => {
    return new Promise((resolve, reject) => {
        fs.readFile("productos.json", "utf8", (error, data) => {
            if(error) return reject("Ha ocurrido un error al cargar los productos.");
            let productos = JSON.parse(data)
            let found = productos.productos.find(producto => producto.id == id);
            if(found){
                resolve(found)
            }else{
                reject("Producto no encontrado.")
            }
        })
    })
}

const actualizarProductos = (productos) => {
    return new Promise((resolve, reject) => {
        fs.writeFile("productos.json", JSON.stringify(productos, null, 4), (error) => {
            if(error) return reject("Error al actualizar productos.")
            return resolve("productos actualizados correctamente.")
        })
    })
}

function descontarProductos(productosADescontar){
    return new Promise((resolve, reject) => {
        leerArchivo("productos.json").then(data => {
            productosADescontar.productos.forEach(producto => {
                let productoDescontado = data.productos.find(element => element.id == producto.id)
                productoDescontado.stock = productoDescontado.stock - producto.cantidad;
            });
            actualizarArchivo("productos.json", data).then(respuesta => {
                resolve(respuesta)
            }).catch(error => {
                reject(error)
            })
        }).catch(error => {
            reject(error)
        })
    })
}

function leerArchivo(nombre) {
    return new Promise((resolve, reject) => {
        fs.readFile(nombre, "utf8", (error, data )=> {
            if(error) reject("Error al leer los datos.")
            data = JSON.parse(data);
            resolve(data);
        })
    })
}


//RUTAS

//RUTA PRINCIPAL HOME
app.get("/", (req, res) => {
    leerProductos().then(productos=> {
        res.render("home", {
            productos: productos.productos
        });
    }).catch(error => {
        res.render("home", {
            error
        });
    })
})

app.get("/inventario", (req, res) => {
    leerProductos().then(productos=> {
        res.render("inventario", {
            productos: productos.productos
        });
    }).catch(error => {
        res.render("inventario", {
            error
        });
    })
})

app.get("/carrito", (req, res) =>{
    res.render("carrito");
})

app.get("/ventas", (req, res) =>{
    res.render("ventas");
})

app.get("/update/productos/:id", (req, res) => {
    let { id } = req.params;
    leerProductosPorId(id).then(producto => {
        res.render("updateProducto", {
            producto
        })

    }).catch(error => {
        res.render("updateProducto", {
            error
        })
    })
})

app.put("/productos/:id", async (req, res) => {
    try {
        let {id} = req.params;
    let { nombre, descripcion, stock, precio, descuento, categoria } = req.body;
    
    let productoModificado = {
        id, nombre, descripcion, stock, precio, descuento, categoria
    };

    let productos = await leerProductos();

    // buscamos indice del producto que vamos a modificar
    let index = productos.productos.findIndex(producto => producto.id == id)
    // le asignamos en primera instancia el nombre de la imágen antigua
        productoModificado.imagen = productos.productos[index].imagen
        //reemplazamos objeto antiguo por el nuevo.
        productos.productos[index] = productoModificado;

        // si llega una foto
        if(req.files){
            let foto = req.files.foto; 
            //creamos un nombre único para cada imagen usando uuid
            let nombreImagen = `${uuid().slice(0,6)}-${foto.name}`;
            //eliminamos foto antigua
            let rutaFotoAntigua = __dirname + '/public/imgs/' + productos.productos[index].imagen;
            //validamos si existe imagen antigua
           fs.readFile(rutaFotoAntigua, "utf8", (error, data) => {
                if(data){
                    //si efectivamente existia la foto antigua, la elimnamos.
                    fs.unlinkSync(rutaFotoAntigua)
                }


                //le asignamos el nombre muevo al producto 
                productos.productos[index].imagen = nombreImagen;
                //creamos ruta para guardar imágenes.
                let rutaImagen = __dirname + '/public/imgs/' + nombreImagen;
                //guardamos imagen en carpeta usando función mv.

                foto.mv(rutaImagen, async (error) => {
                    if(error){
                        return res.status(500).json({code: 500, message: "error al guardar la imagen"})
                    }else{
                        console.log("actualizar producto con foto")
                        await actualizarProductos(productos)
                        return res.json({code: 200, message: "Producto actualizado correctamente."})
                    }
                })
           })

        }else{
            console.log("actualizar producto sin foto")
            await actualizarProductos(productos)
            return res.json({code: 200, message:"Producto actualizado correctamente."})
        }
        
    } catch (error) {
        console.log(error)
        res.status(500).json({code: 500, message: "Error al actualizar el producto"})
    }
})


// del que hice yo
app.delete("/productos/:id", async (req, res) => {
    try {
        let {id} = req.params;

        let productos = await leerProductos();

        // buscamos indice del producto que vamos a eliminar
        let index = productos.productos.findIndex(producto => producto.id == id)

        //validamos si existe el producto con el id solicitado
        if(index >= 0){
            //eliminamos la foto si existe
            if(productos.productos[index].imagen){
                let rutaFotoAntigua = __dirname + '/public/imgs/' + productos.productos[index].imagen;
                //validamos si existe imagen antigua
                fs.readFile(rutaFotoAntigua, "utf8", (error, data) => {
                    if(data){
                        //si efectivamente existia la foto antigua, la elimnamos.
                        fs.unlinkSync(rutaFotoAntigua)
                    }
                })
            }

            //eliminamos el producto del arreglo de productos
            productos.productos.splice(index, 1);

            await actualizarProductos(productos);

            return res.json({code: 200, message: "Producto eliminado correctamente."})
        }else{
            return res.status(404).json({code: 404, message: "Producto no encontrado."})
        }
    } catch (error) {
        console.log(error)
        res.status(500).json({code: 500, message: "Error al eliminar el producto"})
    }
})




// 2) /producto POST: Almacena los datos de un nuevo producto, ok funciona:

app.post("/producto", (req, res) => {
    let {nombre,descripcion,precio,descuento,stock,categoria,imagen,cupon} = req.body;
    let productoNuevo = {
        id: uuid().slice(0,6),
        nombre,
        descripcion,
        precio,
        descuento,
        stock,
        categoria,
        imagen,
        cupon
    }
    fs.readFile("productos.json", "utf8", (error, data) => {
        if(error){
            return res.status(500).json({error:500, message:"Ha ocurrido un error al leer los productos."})
        }
        let productos = JSON.parse(data);
        productos.productos.push(productoNuevo);
  
        fs.writeFile("productos.json", JSON.stringify(productos, null, 4), "utf8", (error) => {
            if(error){
                return res.status(500).json({error:500, message:"Ha ocurrido un error al leer los productos."})
            }
            res.status(201).json(productoNuevo);
        })
    })
})


// trabajar esto, todo lo de arriba funciona

/

// aquí empiezo a hacer rutas yo para el carro de compras
//RUTAS / ENDPOINTS VENTAS



app.route("/api/ventas")
    .get((req, res) =>{
        leerArchivo("ventas.json").then(respuesta => {
            res.json(respuesta)
        }).catch(error => {
            return res.status(500).json({code: 500, message: error})
        })
    })
    .post((req, res) =>{
        if (!req.body || !Array.isArray(req.body) || req.body.length === 0) {
            return res.status(400).json({code: 400, message: "Debe enviar al menos un producto"})
        }

        let productos = req.body;

        leerArchivo("productos.json").then(productosTienda => {
            let nuevaVenta = venderProductos(productos, productosTienda);
            return leerArchivo("ventas.json").then(ventas => {
                ventas.ventas.push(nuevaVenta);
                return ventas;
            }).then(data => {
                actualizarArchivo("ventas.json", data)
                    .then(respuesta => {
                        res.status(201).json({code: 201, message: respuesta})
                    }).catch(error => {
                        res.status(500).json({code: 500, message: error})
                    })
            }).catch(error => {
                res.status(500).json({code:500, message: error})
            }).finally(() => {
                descontarProductos(nuevaVenta).then(respuesta => {
                    console.log(respuesta)
                }).catch(error => {
                    console.log("error: ", error)
                })
            })
        }).catch(error => {
            res.status(500).json({code:500, message: error})
        })
})

function venderProductos(productos, productosTienda) {
    let nuevaVenta = {
        id:  uuid().slice(0,6),
        fecha: moment().format('DD-MM-YYYY'),
        productos,
        total: 0
    }

    productos.forEach(producto => {
        let productoEncontrado = productosTienda.productos.find(element => element.id == producto.id)
        nuevaVenta.total += productoEncontrado.precio * producto.cantidad;
    })

    return nuevaVenta;
}



function actualizarArchivo(nombre, data){
    return new Promise((resolve, reject) => {
        fs.writeFile(nombre, JSON.stringify(data, null, 4), "utf8", (error) => {
            if(error) reject("Error al registrar los datos.");
            resolve("Proceso se ha completado con éxito.");
        })
    })

}




//RUTAS / ENDPOINTS PRODUCTOS
app.route("/api/productos")
    .get((req, res) =>{
        fs.readFile("productos.json", "utf8", (error, data)=> {
            if(error) return res.status(500).end({code: 500, message: "No se ha podido acceder al listado de productos"});
            let productos = JSON.parse(data);
            res.json(productos);
        })
    })
    .post((req, res) =>{
        let nuevoProducto = req.body;
        nuevoProducto.id = uuid().slice(0,6);
        fs.readFile("productos.json", "utf8", (error, data)=> {
            if(error) return res.status(500).end({code: 500, message: "No se ha podido acceder al listado de productos"});
            let productos = JSON.parse(data);

            productos.productos.push(nuevoProducto);

            fs.writeFile("productos.json", JSON.stringify(productos, null, 4), "utf8", (error) => {
                if(error) return res.status(500).end({code: 500, message: "No se ha podido acceder al listado de productos"});
                res.json(productos);
            })

        })
    })
    .put((req, res) =>{
        fs.readFile("productos.json", "utf8", (error, data)=> {
            if(error) return res.status(500).end({code: 500, message: "No se ha podido acceder al listado de productos"});
            let productos = JSON.parse(data);
            let productoActulizado = req.body;

            productos.productos = productos.productos.map(producto => {
                if(producto.id == productoActulizado.id){
                    producto = productoActulizado;
                }
                console.log(producto);
                return producto;
            })

            fs.writeFile("productos.json", JSON.stringify(productos, null, 4), "utf8", (error) => {
                if(error) return res.status(500).end({code: 500, message: "No se ha podido acceder al listado de productos"});
                res.json({code: 201, message:"Producto actualizado correctamente."})
            })

        })
    })
    .delete((req, res) =>{
        let {id} = req.query || false;//obtenemos el id del producto enviado mediante la url

        if(id){
            fs.readFile("productos.json", "utf8", (error, data)=> {
                if(error) return res.status(500).end({code: 500, message: "No se ha podido acceder al listado de productos"});
                let productos = JSON.parse(data);
    
                productos.productos = productos.productos.filter(producto => producto.id != id)

                fs.writeFile("productos.json", JSON.stringify(productos, null, 4), "utf8", (error) => {
                    if(error) return res.status(500).end({code: 500, message: "No se ha podido acceder al listado de productos"});
                    res.json(productos);
                })
    
            })
        }else {
            res.status(400).send({code: 400, message: "debe proporcionar el id del producto a eliminar."})
        }
    })

    //RUTA QUE PERMITIRÁ FILTRAR POR ID
app.route("/api/productos/:id")
    .get((req, res) =>{
        let { id } = req.params;
        fs.readFile("productos.json", "utf8", (error, data)=> {
            if(error) return res.status(500).end({code: 500, message: "No se ha podido acceder al listado de productos"});
            let productos = JSON.parse(data);

            let productoBuscado = productos.productos.find(producto => producto.id == id);
            res.json(productoBuscado);
        })
})

app.route("/api/productos/filter/:ids")
    .get((req, res) =>{
        let { ids } = req.params;
        fs.readFile("productos.json", "utf8", (error, data)=> {
            if(error) return res.status(500).end({code: 500, message: "No se ha podido acceder al listado de productos"});
            let productos = JSON.parse(data);

            let productosFiltrados = productos.productos.filter(producto => ids.includes(producto.id));
            res.json(productosFiltrados);
        })
})


  
