
var canvas;
var gl;

var program;

var near = 1;
var far = 100;


var left = -6.0;
var right = 6.0;
var ytop =6.0;
var bottom = -6.0;


var lightPosition2 = vec4(100.0, 100.0, 100.0, 1.0 );
var lightPosition = vec4(0.0, 0.0, 100.0, 1.0 );

var lightAmbient = vec4(0.2, 0.2, 0.2, 1.0 );
var lightDiffuse = vec4( 1.0, 1.0, 1.0, 1.0 );
var lightSpecular = vec4( 1.0, 1.0, 1.0, 1.0 );

var materialAmbient = vec4( 1.0, 0.0, 1.0, 1.0 );
var materialDiffuse = vec4( 1.0, 0.8, 0.0, 1.0 );
var materialSpecular = vec4( 0.4, 0.4, 0.4, 1.0 );
var materialShininess = 30.0;

var ambientColor, diffuseColor, specularColor;

var modelMatrix, viewMatrix, modelViewMatrix, projectionMatrix, normalMatrix;
var modelViewMatrixLoc, projectionMatrixLoc, normalMatrixLoc;
var eye;
var at = vec3(0.0, 0.0, 0.0);
var up = vec3(0.0, 1.0, 0.0);

var RX = 0;
var RY = 0;
var RZ = 0;

var MS = []; // The modeling matrix stack
var TIME = 0.0; // Realtime
var copyTIME = [0.0, 0.0, 0.0] // bruhtime Original
var dt = 0.0
var prevTime = 0.0;
var resetTimerFlag = true;
var animFlag = false;
var controller;

// These are used to store the current state of objects.
// In animation it is often useful to think of an object as having some DOF
// Then the animation is simply evolving those DOF over time.
var currentRotation = [0,0,0];

var flipTextures = 0;
var useTextures = 1;
var blend = 0.0;

//making a texture image procedurally
//Let's start with a 1-D array
var texSize = 8;
var imageCheckerBoardData = new Array();

// Now for each entry of the array make another array
// 2D array now!
for (var i =0; i<texSize; i++)
	imageCheckerBoardData[i] = new Array();

// Now for each entry in the 2D array make a 4 element array (RGBA! for colour)
for (var i =0; i<texSize; i++)
	for ( var j = 0; j < texSize; j++)
		imageCheckerBoardData[i][j] = new Float32Array(4);

// Now for each entry in the 2D array let's set the colour.
// We could have just as easily done this in the previous loop actually
for (var i =0; i<texSize; i++) 
	for (var j=0; j<texSize; j++) {
		var c = (i + j ) % 2;
		imageCheckerBoardData[i][j] = [c, c, c, 1];
}

//Convert the image to uint8 rather than float.
var imageCheckerboard = new Uint8Array(4*texSize*texSize);

for (var i = 0; i < texSize; i++)
	for (var j = 0; j < texSize; j++)
	   for(var k =0; k<4; k++)
			imageCheckerboard[4*texSize*i+4*j+k] = 255*imageCheckerBoardData[i][j][k];
		
// For this example we are going to store a few different textures here
var textureArray = [] ;

// Setting the colour which is needed during illumination of a surface
function setColor(c)
{
    ambientProduct = mult(lightAmbient, c);
    diffuseProduct = mult(lightDiffuse, c);
    specularProduct = mult(lightSpecular, materialSpecular);
    
    gl.uniform4fv( gl.getUniformLocation(program,
                                         "ambientProduct"),flatten(ambientProduct) );
    gl.uniform4fv( gl.getUniformLocation(program,
                                         "diffuseProduct"),flatten(diffuseProduct) );
    gl.uniform4fv( gl.getUniformLocation(program,
                                         "specularProduct"),flatten(specularProduct) );
    gl.uniform4fv( gl.getUniformLocation(program,
                                         "lightPosition"),flatten(lightPosition2) );
    gl.uniform1f( gl.getUniformLocation(program, 
                                        "shininess"),materialShininess );
}

// We are going to asynchronously load actual image files this will check if that call if an async call is complete
// You can use this for debugging
function isLoaded(im) {
    if (im.complete) {
        console.log("loaded") ;
        return true ;
    }
    else {
        console.log("still not loaded!!!!") ;
        return false ;
    }
}

// Helper function to load an actual file as a texture
// NOTE: The image is going to be loaded asyncronously (lazy) which could be
// after the program continues to the next functions. OUCH!
function loadFileTexture(tex, filename)
{
	//create and initalize a webgl texture object.
    tex.textureWebGL  = gl.createTexture();
    tex.image = new Image();
    tex.image.src = filename ;
    tex.isTextureReady = false ;
    tex.image.onload = function() { handleTextureLoaded(tex); }
}

// Once the above image file loaded with loadFileTexture is actually loaded,
// this funcion is the onload handler and will be called.
function handleTextureLoaded(textureObj) {
	//Binds a texture to a target. Target is then used in future calls.
		//Targets:
			// TEXTURE_2D           - A two-dimensional texture.
			// TEXTURE_CUBE_MAP     - A cube-mapped texture.
			// TEXTURE_3D           - A three-dimensional texture.
			// TEXTURE_2D_ARRAY     - A two-dimensional array texture.
    gl.bindTexture(gl.TEXTURE_2D, textureObj.textureWebGL);
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // otherwise the image would be flipped upsdide down
	
	//texImage2D(Target, internalformat, width, height, border, format, type, ImageData source)
    //Internal Format: What type of format is the data in? We are using a vec4 with format [r,g,b,a].
        //Other formats: RGB, LUMINANCE_ALPHA, LUMINANCE, ALPHA
    //Border: Width of image border. Adds padding.
    //Format: Similar to Internal format. But this responds to the texel data, or what kind of data the shader gets.
    //Type: Data type of the texel data
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textureObj.image);
	
	//Set texture parameters.
    //texParameteri(GLenum target, GLenum pname, GLint param);
    //pname: Texture parameter to set.
        // TEXTURE_MAG_FILTER : Texture Magnification Filter. What happens when you zoom into the texture
        // TEXTURE_MIN_FILTER : Texture minification filter. What happens when you zoom out of the texture
    //param: What to set it to.
        //For the Mag Filter: gl.LINEAR (default value), gl.NEAREST
        //For the Min Filter: 
            //gl.LINEAR, gl.NEAREST, gl.NEAREST_MIPMAP_NEAREST, gl.LINEAR_MIPMAP_NEAREST, gl.NEAREST_MIPMAP_LINEAR (default value), gl.LINEAR_MIPMAP_LINEAR.
    //Full list at: https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/texParameter
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
	
	//Generates a set of mipmaps for the texture object.
        /*
            Mipmaps are used to create distance with objects. 
        A higher-resolution mipmap is used for objects that are closer, 
        and a lower-resolution mipmap is used for objects that are farther away. 
        It starts with the resolution of the texture image and halves the resolution 
        until a 1x1 dimension texture image is created.
        */
    gl.generateMipmap(gl.TEXTURE_2D);
	
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); //Prevents s-coordinate wrapping (repeating)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); //Prevents t-coordinate wrapping (repeating)
    gl.bindTexture(gl.TEXTURE_2D, null);
    console.log(textureObj.image.src) ;
    
    textureObj.isTextureReady = true ;
}

// Takes an array of textures and calls render if the textures are created/loaded
// This is useful if you have a bunch of textures, to ensure that those files are
// actually laoded from disk you can wait and delay the render function call
// Notice how we call this at the end of init instead of just calling requestAnimFrame like before
function waitForTextures(texs) {
    setTimeout(
		function() {
			   var n = 0 ;
               for ( var i = 0 ; i < texs.length ; i++ )
               {
                    console.log(texs[i].image.src) ;
                    n = n+texs[i].isTextureReady ;
               }
               wtime = (new Date()).getTime() ;
               if( n != texs.length )
               {
               		console.log(wtime + " not ready yet") ;
               		waitForTextures(texs) ;
               }
               else
               {
               		console.log("ready to render") ;
					render(0);
               }
		},
	5) ;
}

// This will use an array of existing image data to load and set parameters for a texture
// We'll use this function for procedural textures, since there is no async loading to deal with
function loadImageTexture(tex, image) {
	//create and initalize a webgl texture object.
    tex.textureWebGL  = gl.createTexture();
    tex.image = new Image();

	//Binds a texture to a target. Target is then used in future calls.
		//Targets:
			// TEXTURE_2D           - A two-dimensional texture.
			// TEXTURE_CUBE_MAP     - A cube-mapped texture.
			// TEXTURE_3D           - A three-dimensional texture.
			// TEXTURE_2D_ARRAY     - A two-dimensional array texture.
    gl.bindTexture(gl.TEXTURE_2D, tex.textureWebGL);

	//texImage2D(Target, internalformat, width, height, border, format, type, ImageData source)
    //Internal Format: What type of format is the data in? We are using a vec4 with format [r,g,b,a].
        //Other formats: RGB, LUMINANCE_ALPHA, LUMINANCE, ALPHA
    //Border: Width of image border. Adds padding.
    //Format: Similar to Internal format. But this responds to the texel data, or what kind of data the shader gets.
    //Type: Data type of the texel data
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, texSize, texSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, image);
	
	//Generates a set of mipmaps for the texture object.
        /*
            Mipmaps are used to create distance with objects. 
        A higher-resolution mipmap is used for objects that are closer, 
        and a lower-resolution mipmap is used for objects that are farther away. 
        It starts with the resolution of the texture image and halves the resolution 
        until a 1x1 dimension texture image is created.
        */
    gl.generateMipmap(gl.TEXTURE_2D);
	
	//Set texture parameters.
    //texParameteri(GLenum target, GLenum pname, GLint param);
    //pname: Texture parameter to set.
        // TEXTURE_MAG_FILTER : Texture Magnification Filter. What happens when you zoom into the texture
        // TEXTURE_MIN_FILTER : Texture minification filter. What happens when you zoom out of the texture
    //param: What to set it to.
        //For the Mag Filter: gl.LINEAR (default value), gl.NEAREST
        //For the Min Filter: 
            //gl.LINEAR, gl.NEAREST, gl.NEAREST_MIPMAP_NEAREST, gl.LINEAR_MIPMAP_NEAREST, gl.NEAREST_MIPMAP_LINEAR (default value), gl.LINEAR_MIPMAP_LINEAR.
    //Full list at: https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/texParameter
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); //Prevents s-coordinate wrapping (repeating)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); //Prevents t-coordinate wrapping (repeating)
    gl.bindTexture(gl.TEXTURE_2D, null);

    tex.isTextureReady = true;
}

// This just calls the appropriate texture loads for this example adn puts the textures in an array
function initTexturesForExample() {
    textureArray.push({}) ;
    loadFileTexture(textureArray[textureArray.length-1],"Images/sunset.bmp") ;
    
    textureArray.push({}) ;
    loadImageTexture(textureArray[textureArray.length-1],imageCheckerboard) ;
	
	textureArray.push({}) ;
    loadFileTexture(textureArray[textureArray.length-1],"Images/pexels-flickr-149419.jpg") ;
	
	textureArray.push({}) ;
    loadFileTexture(textureArray[textureArray.length-1],"Images/confused-cat-copy.jpg") ;
	
	textureArray.push({}) ;
    loadFileTexture(textureArray[textureArray.length-1],"Images/cat-staring-at-phone-copy.jpg") ;
	
	textureArray.push({}) ;
    loadFileTexture(textureArray[textureArray.length-1],"Images/sleepy-cat.jpg") ;
	
	textureArray.push({}) ;
    loadFileTexture(textureArray[textureArray.length-1],"Images/professor-doggo-copy.jpg") ;
	
	textureArray.push({}) ;
    loadFileTexture(textureArray[textureArray.length-1],"Images/optical-illusion1.png") ;
	
	textureArray.push({}) ;
    loadFileTexture(textureArray[textureArray.length-1],"Images/floor-texture.jpg") ;
	
	textureArray.push({}) ;
    loadFileTexture(textureArray[textureArray.length-1],"Images/table-texture.jpg") ;
	
	textureArray.push({}) ;
    loadFileTexture(textureArray[textureArray.length-1],"Images/chair-texture.jpg") ;
	
	textureArray.push({}) ;
    loadFileTexture(textureArray[textureArray.length-1],"Images/optical-illusion2.png") ;
}

// Changes which texture is active in the array of texture examples (see initTexturesForExample)
function toggleTextures() {
    //useTextures = (useTextures + 1) % 3
	flipTextures = (flipTextures + 1) % 3
	gl.uniform1i(gl.getUniformLocation(program, "useTextures"), useTextures);
}

window.onload = function init() {

    canvas = document.getElementById( "gl-canvas" );
    
    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }

    gl.viewport( 0, 0, canvas.width, canvas.height );
    //gl.clearColor( 0.5, 0.5, 1.0, 1.0 );
	gl.clearColor( 0.8, 0.8, 0.8, 1.0 );
    
    gl.enable(gl.DEPTH_TEST);

    //
    //  Load shaders and initialize attribute buffers
    //
    program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );
    

    setColor(materialDiffuse);
	
	// Initialize some shapes, note that the curved ones are procedural which allows you to parameterize how nice they look
	// Those number will correspond to how many sides are used to "estimate" a curved surface. More = smoother
    Cube.init(program);
    Cylinder.init(20,program);
    Cone.init(20,program);
    Sphere.init(36,program);

    // Matrix uniforms
    modelViewMatrixLoc = gl.getUniformLocation( program, "modelViewMatrix" );
    normalMatrixLoc = gl.getUniformLocation( program, "normalMatrix" );
    projectionMatrixLoc = gl.getUniformLocation( program, "projectionMatrix" );
    
    // Lighting Uniforms
    gl.uniform4fv( gl.getUniformLocation(program, 
       "ambientProduct"),flatten(ambientProduct) );
    gl.uniform4fv( gl.getUniformLocation(program, 
       "diffuseProduct"),flatten(diffuseProduct) );
    gl.uniform4fv( gl.getUniformLocation(program, 
       "specularProduct"),flatten(specularProduct) );	
    gl.uniform4fv( gl.getUniformLocation(program, 
       "lightPosition"),flatten(lightPosition) );
    gl.uniform1f( gl.getUniformLocation(program, 
       "shininess"),materialShininess );

	
    document.getElementById("animToggleButton").onclick = function() {
        if( animFlag ) {
            animFlag = false;
        }
        else {
            animFlag = true  ;
            resetTimerFlag = true ;
            window.requestAnimFrame(render);
        }
    };
    /*
    document.getElementById("textureToggleButton").onclick = function() {
        toggleTextures() ;
        window.requestAnimFrame(render);
    };
	*/
	
    var controller = new CameraController(canvas);
    controller.onchange = function(xRot,yRot) {
        RX = xRot ;
        RY = yRot ;
        window.requestAnimFrame(render); };
	
	
	// Helper function just for this example to load the set of textures
    initTexturesForExample() ;

    waitForTextures(textureArray);
}

// Sets the modelview and normal matrix in the shaders
function setMV() {
    modelViewMatrix = mult(viewMatrix,modelMatrix);
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix) );
    normalMatrix = inverseTranspose(modelViewMatrix);
    gl.uniformMatrix4fv(normalMatrixLoc, false, flatten(normalMatrix) );
}

// Sets the projection, modelview and normal matrix in the shaders
function setAllMatrices() {
    gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix) );
    setMV();   
}

// Draws a 2x2x2 cube center at the origin
// Sets the modelview matrix and the normal matrix of the global program
// Sets the attributes and calls draw arrays
function drawCube() {
    setMV();
    Cube.draw();
}

// Draws a sphere centered at the origin of radius 1.0.
// Sets the modelview matrix and the normal matrix of the global program
// Sets the attributes and calls draw arrays
function drawSphere() {
    setMV();
    Sphere.draw();
}

// Draws a cylinder along z of height 1 centered at the origin
// and radius 0.5.
// Sets the modelview matrix and the normal matrix of the global program
// Sets the attributes and calls draw arrays
function drawCylinder() {
    setMV();
    Cylinder.draw();
}

// Draws a cone along z of height 1 centered at the origin
// and base radius 1.0.
// Sets the modelview matrix and the normal matrix of the global program
// Sets the attributes and calls draw arrays
function drawCone() {
    setMV();
    Cone.draw();
}

//Floor
//uses the 3d cube to create a floor
class Floor {
	//creates a 3d cube as floor
	createFloor = function() {
		setMV();
		Cube.draw();
	}
	//sets the floor location, size and color
	drawFloor = function() {
		gPush();
			useTextures = 0;
			gl.uniform1i(gl.getUniformLocation(program, "useTextures"), useTextures);
			gl.bindTexture(gl.TEXTURE_2D, textureArray[8].textureWebGL);
			this.color = vec4(0.0,1.0,0.4,1.0);
			setColor(this.color);
			gTranslate(0, -3.5, 0);
			gScale(6.0, 1.0, 6.0);
			this.createFloor();
			useTextures = 1;
			gl.uniform1i(gl.getUniformLocation(program, "useTextures"), useTextures);
		gPop();
	}
	//updates the floor information but not in this case
	updateFloor = function() {
		this.drawFloor();
	}
}

//Table
//uses the 3d cube to create a chair
class Table {
	//creates a 3d cube as floor
	createTable = function() {
		setMV();
		Cube.draw();
	}
	//sets the floor location, size and color
	drawTable = function() {
		gPush();
			useTextures = 0;
			gl.uniform1i(gl.getUniformLocation(program, "useTextures"), useTextures);
			gl.bindTexture(gl.TEXTURE_2D, textureArray[9].textureWebGL);
			this.color = vec4(1.0,0.0,0.4,1.0);
			setColor(this.color);
			gTranslate(0, -2.0, -3);
			gScale(5.9, 1.0, 0.5);
			this.createTable();
			useTextures = 1;
			gl.uniform1i(gl.getUniformLocation(program, "useTextures"), useTextures);
		gPop();
	}
	//updates the floor information but not in this case
	updateTable = function() {
		this.drawTable();
	}
}

//Chair
//uses the 3d cube to create a chair
class Chair {
	//creates a 3d cube as floor
	createChair = function() {
		setMV();
		Cube.draw();
	}
	//sets the floor location, size and color
	drawChair = function() {
		gPush();
			useTextures = 0;
			gl.uniform1i(gl.getUniformLocation(program, "useTextures"), useTextures);
			gl.bindTexture(gl.TEXTURE_2D, textureArray[10].textureWebGL);
			this.color = vec4(1.0,0.0,0.4,1.0);
			setColor(this.color);
			gTranslate(0, -2.08, -5);
			gScale(6.0, 0.42, 0.3);
			this.createChair();
			useTextures = 1;
			gl.uniform1i(gl.getUniformLocation(program, "useTextures"), useTextures);
		gPop();
	}
	//updates the floor information but not in this case
	updateChair = function() {
		this.drawChair();
	}
}

//Board
//uses the 3d cube to create a board
class Board {
	//creates a 3d cube as floor
	createBoard = function() {
		setMV();
		Cube.draw();
	}
	//sets the floor location, size and color
	drawBoard = function() {
		useTextures = 2
		gl.uniform1i(gl.getUniformLocation(program, "useTextures"), useTextures);
		gl.uniform1f(gl.getUniformLocation(program, "blend"), blend);
		
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, textureArray[7].textureWebGL);
		gl.uniform1i(gl.getUniformLocation(program, "texture1"), 0);
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, textureArray[11].textureWebGL);
		gl.uniform1i(gl.getUniformLocation(program, "texture2"), 1);
		
		gl.activeTexture(gl.TEXTURE0);
		gPush();
			this.color = vec4(1.0,0.0,0.4,1.0);
			setColor(this.color);
			gTranslate(0, 1.6, 5);
			gScale(3.0, 1.5, 0.3);
			this.createBoard();
		gPop();
		useTextures = 1;
		gl.uniform1i(gl.getUniformLocation(program, "useTextures"), useTextures);
		
		//side hair
		gPush();
			setColor(vec4(0,0,0,0));
			gTranslate(3.1, 1.6, 5);
			//gRotate(180,0,0,1);
			
			gScale(0.1, 1.5, 0.3);
			this.createBoard();
		gPop();
		gPush();
			setColor(vec4(0,0,0,0));
			gTranslate(-3.1, 1.6, 5);
			//gRotate(180,0,0,1);
			
			gScale(0.1, 1.5, 0.3);
			this.createBoard();
		gPop();
		//top hair
		gPush();
			setColor(vec4(0,0,0,0));
			gTranslate(0, 3.2, 5);
			//gRotate(180,0,0,1);
			
			gScale(3.2, 0.1, 0.3);
			this.createBoard();
		gPop();
		//back hair
		gPush();
			setColor(vec4(0,0,0,0));
			gTranslate(0, 1.6, 5.3);
			gScale(3.2, 1.7, 0.01);
			this.createBoard();
		gPop();
		//bottom hair
		//setColor(vec4(1,0,1,1));
		gPush();
			setColor(vec4(0,0,0,0));
			gTranslate(0, 0, 5);
			//gRotate(180,0,0,1);
			
			gScale(3.2, 0.1, 0.3);
			this.createBoard();
		gPop();
	}
	//updates the floor information but not in this case
	updateBoard = function() {
		this.drawBoard();
	}
}

//Human
//uses the 3d cube and spheres to create a human
//function names specify body parts
class Human {
	//obvious names
	createHead = function() {
		setMV();
		Cube.draw();
	}
	createNeck = function() {
		setMV();
		Sphere.draw();
	}
	createBody = function() {
		setMV();
		Cube.draw();
	}
	createWaist = function() {
		setMV();
		Sphere.draw();
	}
	createArm = function() {
		setMV();
		Cube.draw();
	}
	createHand = function() {
		setMV();
		Cube.draw();
	}
	createThigh = function() {
		setMV();
		Cube.draw();
	}
	createLeg = function() {
		setMV();
		Cube.draw();
	}
	createFoot = function() {
		setMV();
		Cube.draw();
	}
	createPhone = function() {
		setMV();
		Cube.draw();
	}
	createStick = function() {
		setMV();
		Cube.draw();
	}
	//Teacher
	//obvious names
	drawTeacher = function() {
		gPush();
			gTranslate(3.5,1.1,0)
			//+ (Math.sin(TIME * 2)* 0.125)
			//console.log(copyTIME)
			//gRotate(copyTIME[0],1,0,0)
			gRotate(0,1,0,0)
			gTranslate(0,0.5,0)
			gPush();
				//gTranslate(0,0,0)
				gTranslate(0,0.75,0);
				gRotate(180,(Math.sin(TIME * 2) * 0.125),1,0);
				gScale(0.15,0.15,0.15);
				
				this.createNeck();
				useTextures = 0;
				gl.uniform1i(gl.getUniformLocation(program, "useTextures"), useTextures);
				gl.bindTexture(gl.TEXTURE_2D, textureArray[6].textureWebGL);
				gPush();
					gTranslate(0,3.1,0);
					gRotate(180,0,0,1);
					
					gScale(2,2,2);
					this.createHead();
				gPop();
				useTextures = 1;
				gl.uniform1i(gl.getUniformLocation(program, "useTextures"), useTextures);
				//side hair
				gPush();
					setColor(vec4(0,0,0,0));
					gTranslate(2.0,3.1,0);
					gRotate(180,0,0,1);
					
					gScale(0.1,2,2);
					this.createHead();
				gPop();
				gPush();
					setColor(vec4(0,0,0,0));
					gTranslate(-2.0,3.1,0);
					gRotate(180,0,0,1);
					
					gScale(0.1,2,2);
					this.createHead();
				gPop();
				//top hair
				gPush();
					setColor(vec4(0,0,0,0));
					gTranslate(0,5.1,0);
					gRotate(180,0,0,1);
					
					gScale(2,0.1,2);
					this.createHead();
				gPop();
				//back hair
				gPush();
					setColor(vec4(0,0,0,0));
					gTranslate(0,3.1,-2);
					gRotate(180,0,0,1);
					
					gScale(2,2,0.1);
					this.createHead();
				gPop();
				//bottom hair
				setColor(vec4(1,0,1,1));
				gPush();
					gTranslate(0,1,0);
					gRotate(180,0,0,1);
					
					gScale(2,0.1,2);
					this.createHead();
				gPop();
			gPop();
			//gTranslate(0,-0.1,0)
			gPush();
				gTranslate(0,0,0);
				gRotate(180,0,0,1);
				gScale(0.5,0.7,0.3);
				this.createBody();
			gPop();
			
			gPush();
				setColor(vec4(0,0,1,1));
				gTranslate(-0.65,0.45,0);
				//gRotate(180,1,0,0);
				gPush();
					gTranslate(0,-0.1,0);
					gRotate(180,1,0,0);
					gScale(0.15,0.35,0.15);
					this.createArm();
				gPop();
				gPush();
					gTranslate(0,-0.38,0);
					gRotate(15,1,0,0);
					//gRotate(-copyTIME[0],1,0,0);
					gTranslate(0, -0.5, 0);
					gScale(0.15,0.5,0.15);
					this.createHand();
				gPop();
				
				gTranslate(1.3,0,0);
				gRotate(30,0,0,1);
				gPush();
					gTranslate(0,-0.1,0);
					gRotate(180,1,0,0);
					gScale(0.15,0.35,0.15);
					this.createArm();
				gPop();
				
				gPush();
					
					gTranslate(0,-0.38,0);
					
					gRotate(80,0,0,1);
					gRotate(180,Math.sin(TIME) * 0.150,1,0);
					//gRotate(-copyTIME[0],1,0,0);
					gTranslate(0, -0.5, 0);
					gScale(0.15,0.5,0.15);
					this.createHand();
					//gPush();
						setColor(vec4(0,0,0,1));
						gTranslate(0, -2, 0);
						//gRotate(60,0,0,1);
						gScale(0.5,1,0.5);
						this.createStick();
					//gPop();
				gPop();
				
			gPop();
		gPop();
		gPush();
			setColor(vec4(1,0,0,1));
			gTranslate(3.15,-0.1,0);
			gRotate(0,1,0,0);
			gScale(0.14,1.1,0.24);
			this.createThigh();
		gPop();
		
		gPush();
			setColor(vec4(1,0,0,1));
			gTranslate(3.85,-0.1,0);
			gRotate(0,1,0,0);
			gScale(0.14,1.1,0.24);
			this.createThigh();
		gPop();
		/*
		gPush();
			gTranslate(3.85,0.4,0.85);
			gRotate(180,0,0,1);
			gScale(0.15,0.5,0.25);
			this.createLeg();
		gPop();
		
		gPush();
			gTranslate(3.15,0.4,0.85);
			gRotate(180,0,0,1);
			gScale(0.15,0.5,0.25);
			this.createLeg();
		gPop();
		*/
	}
	//Student1
	drawFirstStudent = function() {
		gPush();
			gTranslate(3.5,1.1,0)
			//+ (Math.sin(TIME * 2)* 0.125)
			//console.log(copyTIME)
			gRotate(copyTIME[0],1,0,0)
			//gRotate(0,1,0,0)
			gTranslate(0,0.5,0)
			gPush();
				//gTranslate(0,0,0)
				gTranslate(0,0.75,0);
				gRotate(180,(Math.sin(TIME * 2) * 0.125),1,0);
				gScale(0.15,0.15,0.15);
				
				this.createNeck();
				useTextures = 0;
				gl.uniform1i(gl.getUniformLocation(program, "useTextures"), useTextures);
				gl.bindTexture(gl.TEXTURE_2D, textureArray[5].textureWebGL);
				gPush();
					gTranslate(0,3.1,0);
					gRotate(180,0,0,1);
					
					gScale(2,2,2);
					this.createHead();
				gPop();
				useTextures = 1;
				gl.uniform1i(gl.getUniformLocation(program, "useTextures"), useTextures);
				//side hair
				gPush();
					setColor(vec4(0,0,0,0));
					gTranslate(2.0,3.1,0);
					gRotate(180,0,0,1);
					
					gScale(0.1,2,2);
					this.createHead();
				gPop();
				gPush();
					setColor(vec4(0,0,0,0));
					gTranslate(-2.0,3.1,0);
					gRotate(180,0,0,1);
					
					gScale(0.1,2,2);
					this.createHead();
				gPop();
				//top hair
				gPush();
					setColor(vec4(0,0,0,0));
					gTranslate(0,5.1,0);
					gRotate(180,0,0,1);
					
					gScale(2,0.1,2);
					this.createHead();
				gPop();
				//back hair
				gPush();
					setColor(vec4(0,0,0,0));
					gTranslate(0,3.1,2);
					gRotate(180,0,0,1);
					
					gScale(2,2,0.1);
					this.createHead();
				gPop();
				//bottom hair
				setColor(vec4(1,0,1,1));
				gPush();
					gTranslate(0,1,0);
					gRotate(180,0,0,1);
					
					gScale(2,0.1,2);
					this.createHead();
				gPop();
			gPop();
			//gTranslate(0,-0.1,0)
			gPush();
				gTranslate(0,0,0);
				gRotate(180,0,0,1);
				gScale(0.5,0.7,0.3);
				this.createBody();
			gPop();
			
			gPush();
				setColor(vec4(0,0,1,1));
				gTranslate(-0.65,0.45,0);
				gRotate(-copyTIME[0],1,0,0);
				gPush();
					gTranslate(0,-0.1,0);
					gRotate(180,1,0,0);
					gScale(0.15,0.35,0.15);
					this.createArm();
				gPop();
				gPush();
					gTranslate(0,-0.38,0);
					gRotate(-15,1,0,0);
					//gRotate(-copyTIME[0],1,0,0);
					gTranslate(0, -0.5, 0);
					gScale(0.15,0.5,0.15);
					this.createHand();
				gPop();
				
				gTranslate(1.3,0,0);
				gPush();
					gTranslate(0,-0.1,0);
					gRotate(180,1,0,0);
					gScale(0.15,0.35,0.15);
					this.createArm();
				gPop();
				gPush();
					gTranslate(0,-0.38,0);
					gRotate(-15,1,0,0);
					//gRotate(-copyTIME[0],1,0,0);
					gTranslate(0, -0.5, 0);
					gScale(0.15,0.5,0.15);
					this.createHand();
				gPop();
			gPop();
		gPop();
		gPush();
			setColor(vec4(1,0,0,1));
			gTranslate(3.14,1,0.41);
			gRotate(90,1,0,0);
			gScale(0.15,0.7,0.25);
			this.createThigh();
		gPop();
		
		gPush();
			setColor(vec4(1,0,0,1));
			gTranslate(3.84,1,0.41);
			gRotate(90,1,0,0);
			gScale(0.15,0.7,0.25);
			this.createThigh();
		gPop();
		
		gPush();
			gTranslate(3.84,0.4,0.86);
			gRotate(180,0,0,1);
			gScale(0.15,0.5,0.25);
			this.createLeg();
		gPop();
		
		gPush();
			gTranslate(3.14,0.4,0.86);
			gRotate(180,0,0,1);
			gScale(0.15,0.5,0.25);
			this.createLeg();
		gPop();
		
	}
	
	//Student2
	drawSecondStudent = function() {
		gPush();
			gTranslate(3.5,1.1,0)
			//+ (Math.sin(TIME * 2)* 0.125)
			//console.log(copyTIME[0])
			//gRotate(copyTIME[0],1,0,0)
			gRotate(0,1,0,0)
			gTranslate(0,0.5,0)
			gPush();
				//gTranslate(0,0,0)
				gTranslate(0,0.75,0);
				gRotate(180,(Math.sin(TIME * 2) * 0.125),1,0);
				gScale(0.15,0.15,0.15);
				
				this.createNeck();
				useTextures = 0;
				gl.uniform1i(gl.getUniformLocation(program, "useTextures"), useTextures);
				gl.bindTexture(gl.TEXTURE_2D, textureArray[4].textureWebGL);
				gPush();
					gTranslate(0,3.1,0);
					gRotate(180,0,0,1);
					
					gScale(2,2,2);
					this.createHead();
				gPop();
				useTextures = 1;
				gl.uniform1i(gl.getUniformLocation(program, "useTextures"), useTextures);
				//side hair
				gPush();
					setColor(vec4(0,0,0,0));
					gTranslate(2.0,3.1,0);
					gRotate(180,0,0,1);
					
					gScale(0.1,2,2);
					this.createHead();
				gPop();
				gPush();
					setColor(vec4(0,0,0,0));
					gTranslate(-2.0,3.1,0);
					gRotate(180,0,0,1);
					
					gScale(0.1,2,2);
					this.createHead();
				gPop();
				//top hair
				gPush();
					setColor(vec4(0,0,0,0));
					gTranslate(0,5.1,0);
					gRotate(180,0,0,1);
					
					gScale(2,0.1,2);
					this.createHead();
				gPop();
				//back hair
				gPush();
					setColor(vec4(0,0,0,0));
					gTranslate(0,3.1,2);
					gRotate(180,0,0,1);
					
					gScale(2,2,0.1);
					this.createHead();
				gPop();
				//bottom hair
				setColor(vec4(1,0,1,1));
				gPush();
					gTranslate(0,1,0);
					gRotate(180,0,0,1);
					
					gScale(2,0.1,2);
					this.createHead();
				gPop();
			gPop();
			//gTranslate(0,-0.1,0)
			gPush();
				gTranslate(0,0,0);
				gRotate(180,0,0,1);
				gScale(0.5,0.7,0.3);
				this.createBody();
			gPop();
			
			gPush();
				setColor(vec4(0,0,1,1));
				gTranslate(-0.65,0.45,0);
				gRotate(-copyTIME[0],1,0,0);
				gPush();
					gTranslate(0,-0.1,0);
					gRotate(180,1,0,0);
					gScale(0.15,0.35,0.15);
					this.createArm();
				gPop();
				gPush();
					gTranslate(0,-0.38,0);
					gRotate(-90,1,0,0);
					//gRotate(-copyTIME[0],1,0,0);
					gTranslate(0, -0.5, 0);
					gScale(0.15,0.5,0.15);
					this.createHand();
				gPop();
				
				setColor(vec4(1,0.7,0.1,1));
				gPush();
					gTranslate(0.65,-0.38,0.45);
					gRotate(-90,1,0,0);
					//gRotate(-copyTIME[0],1,0,0);
					gTranslate(0, -0.5, 0);
					gScale(0.5,0.2,0.05);
					this.createPhone();
				gPop();
				
				setColor(vec4(0,0,1,1));
				gTranslate(1.3,0,0);
				gPush();
					gTranslate(0,-0.1,0);
					gRotate(180,1,0,0);
					gScale(0.15,0.35,0.15);
					this.createArm();
				gPop();
				gPush();
					gTranslate(0,-0.38,0);
					gRotate(-90,1,0,0);
					//gRotate(-copyTIME[0],1,0,0);
					gTranslate(0, -0.5, 0);
					gScale(0.15,0.5,0.15);
					this.createHand();
				gPop();
			gPop();
		gPop();
		gPush();
			setColor(vec4(1,0,0,1));
			gTranslate(3.14,1,0.41);
			gRotate(90,1,0,0);
			gScale(0.15,0.7,0.25);
			this.createThigh();
		gPop();
		
		gPush();
			setColor(vec4(1,0,0,1));
			gTranslate(3.84,1,0.41);
			gRotate(90,1,0,0);
			gScale(0.15,0.7,0.25);
			this.createThigh();
		gPop();
		
		gPush();
			gTranslate(3.84,0.4,0.86);
			gRotate(180,0,0,1);
			gScale(0.15,0.5,0.25);
			this.createLeg();
		gPop();
		
		gPush();
			gTranslate(3.14,0.4,0.86);
			gRotate(180,0,0,1);
			gScale(0.15,0.5,0.25);
			this.createLeg();
		gPop();
		
	}
	
	//Student3
	drawThirdStudent = function() {
		gPush();
			gTranslate(3.5,1.1,0)
			//+ (Math.sin(TIME * 2)* 0.125)
			//console.log(copyTIME[0])
			//gRotate(copyTIME[0],1,0,0)
			gRotate(0,1,0,0)
			gTranslate(0,0.5,0)
			gPush();
				//gTranslate(0,0,0)
				gTranslate(0,0.75,0);
				gRotate(180,(Math.sin(TIME * 2) * 0.125),1,0);
				gScale(0.15,0.15,0.15);
				
				this.createNeck();
				useTextures = 0;
				gl.uniform1i(gl.getUniformLocation(program, "useTextures"), useTextures);
				gl.bindTexture(gl.TEXTURE_2D, textureArray[3].textureWebGL);
				
				gRotate(copyTIME[1],0,1,0)
				gPush();
					gTranslate(0,3.1,0);
					
					gScale(2,2,2);
					this.createHead();
				gPop();
				
				useTextures = 1;
				gl.uniform1i(gl.getUniformLocation(program, "useTextures"), useTextures);
				//side hair
				gPush();
					setColor(vec4(0,0,0,0));
					gTranslate(2.0,3.1,0);
					gRotate(180,0,0,1);
					
					gScale(0.1,2,2);
					this.createHead();
				gPop();
				gPush();
					setColor(vec4(0,0,0,0));
					gTranslate(-2.0,3.1,0);
					gRotate(180,0,0,1);
					
					gScale(0.1,2,2);
					this.createHead();
				gPop();
				//top hair
				gPush();
					setColor(vec4(0,0,0,0));
					gTranslate(0,5.1,0);
					gRotate(180,0,0,1);
					
					gScale(2,0.1,2);
					this.createHead();
				gPop();
				//back hair
				gPush();
					setColor(vec4(0,0,0,0));
					gTranslate(0,3.1,2);
					gRotate(180,0,0,1);
					
					gScale(2,2,0.1);
					this.createHead();
				gPop();
				
				//bottom hair
				setColor(vec4(1,0,1,1));
				gPush();
					gTranslate(0,1,0);
					gRotate(180,0,0,1);
					
					gScale(2,0.1,2);
					this.createHead();
				gPop();
				
			gPop();
			//gTranslate(0,-0.1,0)
			gPush();
				gTranslate(0,0,0);
				gRotate(180,0,0,1);
				gScale(0.5,0.7,0.3);
				this.createBody();
			gPop();
			
			gPush();
				setColor(vec4(0,0,1,1));
				gTranslate(-0.65,0.45,0);
				gRotate(-15,1,0,0);
				gPush();
					gTranslate(0,-0.1,0);
					gRotate(180,1,0,0);
					gScale(0.15,0.35,0.15);
					this.createArm();
				gPop();
				gPush();
					gTranslate(0,-0.38,0);
					gRotate(-15,1,0,0);
					//gRotate(-copyTIME,1,0,0);
					gTranslate(0, -0.5, 0);
					gScale(0.15,0.5,0.15);
					this.createHand();
				gPop();
				
				gTranslate(1.3,0,0);
				gPush();
					gTranslate(0,-0.1,0);
					gRotate(180,1,0,0);
					gScale(0.15,0.35,0.15);
					this.createArm();
				gPop();
				gPush();
					gTranslate(0,-0.38,0);
					gRotate(-15,1,0,0);
					//gRotate(-copyTIME,1,0,0);
					gTranslate(0, -0.5, 0);
					gScale(0.15,0.5,0.15);
					this.createHand();
				gPop();
			gPop();
		gPop();
		gPush();
			setColor(vec4(1,0,0,1));
			gTranslate(3.14,1,0.41);
			gRotate(90,1,0,0);
			gScale(0.15,0.7,0.25);
			this.createThigh();
		gPop();
		
		gPush();
			setColor(vec4(1,0,0,1));
			gTranslate(3.84,1,0.41);
			gRotate(90,1,0,0);
			gScale(0.15,0.7,0.25);
			this.createThigh();
		gPop();
		
		gPush();
			gTranslate(3.84,0.4,0.86);
			gRotate(180,0,0,1);
			gScale(0.15,0.5,0.25);
			this.createLeg();
		gPop();
		
		gPush();
			gTranslate(3.14,0.4,0.86);
			gRotate(180,0,0,1);
			gScale(0.15,0.5,0.25);
			this.createLeg();
		gPop();
		
	}
	
	//obvious names
	//the thigh animation is the only animated body part which controls the rest of the lower body
	updateLeftLeg = function() {
		gPush();
			this.py = -0.01;
			gTranslate(3.3,this.py,-0.3);
			gRotate(180,-0.2,-0.3 + (Math.sin(TIME * 2) * 0.125),1);
			
			//Thigh
			gPush();
				gTranslate(0,this.py,0);
				
				gRotate(180,0.1,-1,0);
				gScale(0.2,0.8,0.2);
				this.createThigh();
				
				//this.updateLeftLeg();
			gPop();
			
			//Leg
			gTranslate(0,0,-0.3);
			gPush();
				gTranslate(-0.2,1,0);
				
				gRotate(180,0.1,-1,0.4);
				gScale(0.2,0.5,0.2);
				this.createLeg();
			gPop();
			
			//Foot
			gTranslate(0,0.6,-0.3);
			gPush();
				gTranslate(-0.33,1,0);
				
				gRotate(180,0.1,-1,0.4);
				gScale(0.2,0.2,0.4);
				this.createFoot();
			gPop();
		gPop();
	}
	//obvious names
	updateRightLeg = function() {
		gPush();
			this.py = -0.01;
			gTranslate(4,this.py,-0.3);
			gRotate(180,-0.2,-0.3 + (Math.sin(TIME * 2) * 0.125 * -1),1);
			
			//Thigh
			gPush();
				gTranslate(0,this.py,0);
				
				gRotate(180,0.1,-1,0);
				gScale(0.2,0.8,0.2);
				this.createThigh();
				
			gPop();
			
			//Leg
			gTranslate(0,0,-0.3);
			gPush();
				gTranslate(-0.2,1,0);
				
				gRotate(180,0.1,-1,0.4);
				gScale(0.2,0.5,0.2);
				this.createLeg();
			gPop();
			
			//Foot
			gTranslate(0,0.6,-0.3);
			gPush();
				gTranslate(-0.33,1,0);
				
				gRotate(180,0.1,-1,0.4);
				gScale(0.2,0.2,0.4);
				this.createFoot();
			gPop();
		gPop();
	}
	
	//obvious names
	updateTeacher = function() {
		//gRotate(180,0,-0.5,1);
		gPush();
			setColor(vec4(1.0,0.5,0.5,1.0));
			gTranslate(-8.5,-1.3,3.5);
			this.drawTeacher();
			//this.updateLeftLeg();
			//this.updateRightLeg();
		gPop();
	}
	
	updateFirstStudent = function() {
		//gRotate(180,0,-0.5,1);
		
		gPush();
			
			setColor(vec4(1.0,0.5,0.5,1.0));
			gTranslate(0.5,-2.4,-5);
			this.drawFirstStudent();
			//this.updateLeftLeg();
			//this.updateRightLeg();
		gPop();
	}
	
	updateSecondStudent = function() {
		//gRotate(180,0,-0.5,1);
		gPush();
			setColor(vec4(1.0,0.5,0.5,1.0));
			gTranslate(-3.5,-2.4,-5);
			this.drawSecondStudent();
			//this.updateLeftLeg();
			//this.updateRightLeg();
		gPop();
	}
	
	updateThirdStudent = function() {
		//gRotate(180,0,-0.5,1);
		gPush();
			setColor(vec4(1.0,0.5,0.5,1.0));
			gTranslate(-7.5,-2.4,-5);
			this.drawThirdStudent();
			//this.updateLeftLeg();
			//this.updateRightLeg();
		gPop();
	}
	
}


// Post multiples the modelview matrix with a translation matrix
// and replaces the modeling matrix with the result
function gTranslate(x,y,z) {
    modelMatrix = mult(modelMatrix,translate([x,y,z]));
}

// Post multiples the modelview matrix with a rotation matrix
// and replaces the modeling matrix with the result
function gRotate(theta,x,y,z) {
    modelMatrix = mult(modelMatrix,rotate(theta,[x,y,z]));
}

// Post multiples the modelview matrix with a scaling matrix
// and replaces the modeling matrix with the result
function gScale(sx,sy,sz) {
    modelMatrix = mult(modelMatrix,scale(sx,sy,sz));
}

// Pops MS and stores the result as the current modelMatrix
function gPop() {
    modelMatrix = MS.pop();
}

// pushes the current modelViewMatrix in the stack MS
function gPush() {
    MS.push(modelMatrix);
}

var tablebruh = new Table();
var chairbruh = new Chair();
var boardbruh = new Board();
var floorbruh = new Floor();
var humanbruh = new Human();

bruhswaptime = false;
var blend_check = false;
var then = 0;
function render(timestamp) {
    copyTIME[2]++;
	TIME += dt;
	copyTIME[1] += 90*dt;
	
	if(bruhswaptime == false) {
		copyTIME[0] += 5*dt;
	}
	else {
		copyTIME[0] -= 5*dt;
	}
	
	//fps calculation {
	var diff = TIME - then;
	var fps = 1/diff;
	then = TIME;
	if((copyTIME[2] % 200.0) == 1) {
		document.getElementById("Fps").innerHTML="FPS: " + Math.round(fps);
	}
	
	
	//rotation for students and teacher {
	if(copyTIME[0] > 50) {
		bruhswaptime = true;
	}
	if(copyTIME[0] > 55 || copyTIME[0] < -5) {
		copyTIME[0] = 0;
	}
	if(copyTIME[0] < 0) {
		bruhswaptime = false;
	}
	//}
	
	//transition effect between two textures {
	if((copyTIME[2] % 2.0) == 1 && blend_check == false) {
		blend += 0.01;
	}
	if((copyTIME[2] % 2.0) == 1 && blend_check == true) {
		blend -= 0.01;
	}
	if(blend >= 1) {
		blend_check = true;
	}
	if(blend <= 0) {
		blend_check = false;
	}
	//}
	//console.log(blend);
	
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
	//up = vec3(0.0, 1.0, 0.0)
    //eye = vec3(4, 3,10);
	eye = vec3(0, 3 + Math.sin(TIME/10) * 3,10);
	
	//eye = vec3(0, 0,Math.sin(TIME * 0.5));
    MS = []; // Initialize modeling matrix stack
	
	// initialize the modeling matrix to identity
    modelMatrix = mat4();
    
    // set the camera matrix
    viewMatrix = lookAt(eye, at, up);
   
    // set the projection matrix
    projectionMatrix = ortho(left, right, bottom, ytop, near, far);
	//projectionMatrix = perspective( 60.0, 1, 1, 20 );

    
    // set all the matrices
    setAllMatrices();
    
	if( animFlag )
    {
		// dt is the change in time or delta time from the last frame to this one
		// in animation typically we have some property or degree of freedom we want to evolve over time
		// For example imagine x is the position of a thing.
		// To get the new position of a thing we do something called integration
		// the simpelst form of this looks like:
		// x_new = x + v*dt
		// That is the new position equals the current position + the rate of of change of that position (often a velocity or speed), times the change in time
		// We can do this with angles or positions, the whole x,y,z position or just one dimension. It is up to us!
		dt = (timestamp - prevTime) / 1000.0;
		prevTime = timestamp;
	}
	
	// We need to bind our textures, ensure the right one is active before we draw
	//Activate a specified "texture unit".
    //Texture units are of form gl.TEXTUREi | where i is an integer.
	gl.activeTexture(gl.TEXTURE0);
	
	
	gl.bindTexture(gl.TEXTURE_2D, textureArray[2].textureWebGL);
	gl.uniform1i(gl.getUniformLocation(program, "texture2"), 0);
	
	currentRotation[1] = currentRotation[1] + 10 * dt;
	gRotate(currentRotation[1],0,1,0);
	//gRotate(150,0,1,0);
	//gRotate(90,0,1,0);
	//gRotate(-70,0,1,0);
	//gRotate(0,0,1,0);
	//console.log(currentRotation[1])
	gPush();
		// Now let's draw a shape animated!
		// You may be wondering where the texture coordinates are!
		// We've modified the object.js to add in support for this attribute array!
		gPush();
		{
			currentRotation[2] = currentRotation[2] + 30*dt;
			gRotate(currentRotation[2],0,0,1);
			//drawCube();
		}
		gPop() ;
		
		
		
		gl.bindTexture(gl.TEXTURE_2D, textureArray[0].textureWebGL);
		gl.uniform1i(gl.getUniformLocation(program, "texture1"), 0);
		gPush();
		{
			
			currentRotation[2] = currentRotation[2] + 30 * dt;
			gTranslate(3, 0, 0);
			gRotate(currentRotation[2], 0, 0, 1);
			//drawSphere();
			
		}
		gPop();
		
		//No texture zone
		
		useTextures = 1;
		gl.uniform1i(gl.getUniformLocation(program, "useTextures"), useTextures);
		gPush();
		{
			setColor(vec4(1,0,1,1));
			currentRotation[2] = currentRotation[2] + 30 * dt;
			gTranslate(-3, 0, 0);
			gRotate(currentRotation[2], 0, 0, 1);
			//drawCone();
		}
		gPop();
		
		gPush();
		{
			gPush();
				tablebruh.updateTable();
			gPop();
		}
		gPop();
		
		gPush();
		{
			gPush();
				chairbruh.updateChair();
			gPop();
		}
		gPop();
		
		gPush();
		{
			gPush();
				boardbruh.updateBoard();
			gPop();
		}
		gPop();
		
		gPush();
		{
			gPush();
				floorbruh.updateFloor();
			gPop();
		}
		gPop();
		
		gPush();
		{
			gPush();
				humanbruh.updateFirstStudent();
				humanbruh.updateSecondStudent();
				humanbruh.updateThirdStudent();
				humanbruh.updateTeacher();
			gPop();
		}
		gPop();
	gPop();
	
	useTextures = 0;
	gl.uniform1i(gl.getUniformLocation(program, "useTextures"), useTextures);
    //useTextures = 1;
    if( animFlag )
        window.requestAnimFrame(render);
}

// A simple camera controller which uses an HTML element as the event
// source for constructing a view matrix. Assign an "onchange"
// function to the controller as follows to receive the updated X and
// Y angles for the camera:
//
//   var controller = new CameraController(canvas);
//   controller.onchange = function(xRot, yRot) { ... };
//
// The view matrix is computed elsewhere.
function CameraController(element) {
	var controller = this;
	this.onchange = null;
	this.xRot = 0;
	this.yRot = 0;
	this.scaleFactor = 3.0;
	this.dragging = false;
	this.curX = 0;
	this.curY = 0;
	
	// Assign a mouse down handler to the HTML element.
	element.onmousedown = function(ev) {
		controller.dragging = true;
		controller.curX = ev.clientX;
		controller.curY = ev.clientY;
	};
	
	// Assign a mouse up handler to the HTML element.
	element.onmouseup = function(ev) {
		controller.dragging = false;
	};
	
	// Assign a mouse move handler to the HTML element.
	element.onmousemove = function(ev) {
		if (controller.dragging) {
			// Determine how far we have moved since the last mouse move
			// event.
			var curX = ev.clientX;
			var curY = ev.clientY;
			var deltaX = (controller.curX - curX) / controller.scaleFactor;
			var deltaY = (controller.curY - curY) / controller.scaleFactor;
			controller.curX = curX;
			controller.curY = curY;
			// Update the X and Y rotation angles based on the mouse motion.
			controller.yRot = (controller.yRot + deltaX) % 360;
			controller.xRot = (controller.xRot + deltaY);
			// Clamp the X rotation to prevent the camera from going upside
			// down.
			if (controller.xRot < -90) {
				controller.xRot = -90;
			} else if (controller.xRot > 90) {
				controller.xRot = 90;
			}
			//console.log(controller.curX)
			// Send the onchange event to any listener.
			if (controller.onchange != null) {
				controller.onchange(controller.xRot, controller.yRot);
			}
		}
	};
}
