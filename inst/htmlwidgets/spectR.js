HTMLWidgets.widget({

  name: 'spectR',

  type: 'output',

  factory: function(el, width, height) {

    ///////////////// Polyfills //////////////////
    if (!String.prototype.padStart) {
      String.prototype.padStart = function padStart(targetLength, padString) {
        targetLength = targetLength >> 0; //truncate if number, or convert non-number to 0;
        padString = String(typeof padString !== 'undefined' ? padString : ' ');
        if (this.length >= targetLength) {
          return String(this);
        } else {
          targetLength = targetLength - this.length;
          if (targetLength > padString.length) {
            padString += padString.repeat(targetLength / padString.length);
          }
          return padString.slice(0, targetLength) + String(this);
        }
      };
    }

    if (!Array.prototype.closestTo) {
      Array.prototype.closestTo = function closestTo(x) {
        //var dists = this.map(function(a) { Math.abs(a - x); });
        const N = this.length;
        if (N === 0) {
          return NaN;
        } else {
          var tmpVal = Infinity;
          var tmpInd = -1;
          for (var i=0; i<N; i++) {
            var val = Math.abs(this[i]-x);
            if (val < tmpVal) {
              tmpInd = i;
              tmpVal = val;
            }
          }
          return this[tmpInd];
        }
      };
    }


    if (!Array.prototype.indexOfClosestTo) {
      Array.prototype.indexOfClosestTo = function indexOfClosestTo(x) {
        //var dists = this.map(function(a) { Math.abs(a - x); });
        const N = this.length;
        if (N === 0) {
          return NaN;
        } else {
          var tmpVal = Infinity;
          var tmpInd = -1;
          for (var i=0; i<N; i++) {
            var val = Math.abs(this[i]-x);
            if (val !== null && val < tmpVal) {
              tmpInd = i;
              tmpVal = val;
            }
          }
          return tmpInd;
        }
      };
    }

    /////////////////////////////////////////////


    formatTime = function(secs, sep="-") {
      var ss = Math.floor(secs);
      var fr = secs - ss;
      var seconds = ss % 60;
      var ms = Math.floor(ss / 60);
      var minutes = ms % 60;
      var hours = Math.floor(ms / 3600);
      return(hours.toString().padStart(2,0) + sep + minutes.toString().padStart(2,0) + sep + seconds.toString().padStart(2,0));
    };

    extractMainIdentifier = function(filepath) {
      var ta1 = filepath.split("/");
      var filename = ta1[ta1.length - 1];
      var ta2 = filename.split(".").slice(0,-1);
      return (ta2.join("."));
    };

    addMarker = function(markers, ta, tb, typeStr, colourStr, commentStr) {

      let timeAs;
      let timeBs;
      let types;
      let colours;
      let comments;
      if (typeof(tb) === 'undefined') tb = ta;

      if (markers !== null) {
        timeAs = markers.timeA;
        timeBs = markers.timeB;
        types = markers.type;
        colours = markers.colour;
        comments = markers.comment;
        timeAs.push(ta);
        timeBs.push(tb);
        types.push(typeStr);
        colours.push(colourStr);
        comments.push(commentStr);
      } else {
        timeAs = new Array(); timeAs[0] = ta;
        timeBs = new Array(); timeBs[0] = tb;
        types = new Array(); types[0] = typeStr;
        colours = new Array(); colours[0] = colourStr;
        comments = new Array(); comments[0] = commentStr;
      }

      const output = { timeA: timeAs, timeB: timeBs, type: types, colour: colours, comment: comments };
      return output;
    };

    // TODO: define shared variables for this instance
    var copyMedia = false;
    var capture = false;
    var zoom = 1.0;
    var poi = { x: 0.0, y: 0.0 };
    var old_poi = poi;
    var panning = false;
    var panClickPoint = { x: 0.0, y: 0.0 };
    var subtractPrevFrame = false;
    var frameByFrame = false;
    var noizeOverlay = false;
    //var hoverMarker = -1;
    var hoverPoint = 0.0;
    var hoveringOverScrubber = false;
    var defaultComment = "--";
    var defaultColour = "indianred";
    var definingRegion = false;
    var definingRegionStartTime = null;
    var currSpectrogramFrameID = 0;
    var spectTrans = 0.5;

    resetZoomAndPan = function(dur) {
	    old_poi = poi;
	    target_poi = { x: 0.0, y: 0.0 };
	    //ptt = 0.0; pdt = 1 / dur;
		  zoom = 1.0;
    };

    function getMousePos(canvas, evt) {
        var rect = canvas.getBoundingClientRect();
		    return {
          x: ((evt.clientX - rect.left) / (rect.right - rect.left) * canvas.width),
          y: (evt.clientY - rect.top) / (rect.bottom - rect.top) * canvas.height
        };
    }

    function getMouseNDC(canvas, evt) {
      var rect = canvas.getBoundingClientRect();
		  return {
				x: 2.0 * ((evt.clientX - rect.left) / (rect.right - rect.left) - 0.5),
        y: -2.0 * ((evt.clientY - rect.top) / (rect.bottom - rect.top) - 0.5)
      };
    }

    function getMouseTextureCoord(canvas, evt) {
      var rect = canvas.getBoundingClientRect();
		  return {
				x: (evt.clientX - rect.left) / (rect.right - rect.left),
        y: (evt.clientY - rect.top) / (rect.bottom - rect.top)
      };
    }


    function initMediaCanvasBuffers(gl) {

      // Create a buffer for the square's positions.
      const positionBuffer = gl.createBuffer();

      // Select the positionBuffer as the one to apply buffer
      // operations to from here out.
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

      // Now create an array of positions for the square.
      const positions = [
        -1.0, -1.0,
         1.0, -1.0,
         1.0,  1.0,
        -1.0,  1.0,
      ];

      // Now pass the list of positions into WebGL to build the
      // shape. We do this by creating a Float32Array from the
      // JavaScript array, then use it to fill the current buffer.
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    	// Create the texture coordinates
    	const textureCoordBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);

      const textureCoordinates = [
        // Front
        0.0,  1.0,
        1.0,  1.0,
        1.0,  0.0,
        0.0,  0.0,
    	];

    	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates), gl.STATIC_DRAW);

      // Build the element array buffer; this specifies the indices
      // into the vertex arrays for each face's vertices.
      const indexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

      // This array defines each face as two triangles, using the
      // indices into the vertex array to specify each triangle's
      // position.
      const indices = [
        0,  1,  2,      0,  2,  3,
    	];

      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);


      return {
        position: positionBuffer,
        textureCoord: textureCoordBuffer,
        indices: indexBuffer,
      };
    }


    function initSpectrogramCanvasBuffers(gl) {

      // There will always be three textures in use:
      // the frame containing the current time, and
      // the frames before and after it.

      // Create a buffer for the square's positions.
      const positionBuffer = gl.createBuffer();

      // Select the positionBuffer as the one to apply buffer
      // operations to from here out.
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

      // Now create an array of positions for the three squares.
      const positions = [
        -2.0, -1.0,
         0.0, -1.0,
         0.0,  1.0,
        -2.0,  1.0,

        -1.0, -1.0,
         1.0, -1.0,
         1.0,  1.0,
        -1.0,  1.0,

         0.0, -1.0,
         2.0, -1.0,
         2.0,  1.0,
         0.0,  1.0,
      ];

      // Now pass the list of positions into WebGL to build the
      // shape. We do this by creating a Float32Array from the
      // JavaScript array, then use it to fill the current buffer.
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    	// Create the texture coordinates
    	const textureCoordBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);

      const textureCoordinates = [
       -1.0,  1.0,
        0.0,  1.0,
        0.0,  0.0,
       -1.0,  0.0,

        0.0,  1.0,
        1.0,  1.0,
        1.0,  0.0,
        0.0,  0.0,

        1.0,  1.0,
        2.0,  1.0,
        2.0,  0.0,
        1.0,  0.0,
    	];

    	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates), gl.STATIC_DRAW);

      // Build the element array buffer; this specifies the indices
      // into the vertex arrays for each face's vertices.
      const indexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

      // This array defines each face as two triangles, using the
      // indices into the vertex array to specify each triangle's
      // position.
      const indices = [
        0,  1,  2,      0,  2,  3,
        4,  5,  6,      4,  6,  7,
        8,  9, 10,      8, 10, 11,
    	];

      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);


      return {
        position: positionBuffer,
        textureCoord: textureCoordBuffer,
        indices: indexBuffer,
      };
    }


    function initTexture(gl) {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      const level = 0;
      const internalFormat = gl.RGBA;
      const width = 1;
      const height = 1;
      const border = 0;
      const srcFormat = gl.RGBA;
      const srcType = gl.UNSIGNED_BYTE;
      const pixel = new Uint8Array([0, 0, 255, 255]);  // opaque blue
      gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                    width, height, border, srcFormat, srcType,
                    pixel);

      // Turn off mips and set  wrapping to clamp to edge so it
      // will work regardless of the dimensions of the video.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

      return texture;
    }


    function updateTextureFromVideo(gl, texture, video) {
      const level = 0;
      const internalFormat = gl.RGBA;
      const srcFormat = gl.RGBA;
      const srcType = gl.UNSIGNED_BYTE;
      //gl.activeTexture(gl.TEXTURE0 + unit);
    	gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                    srcFormat, srcType, video);
    }


    function updateTextureFromImage(gl, texture, image) {
      const level = 0;
      const internalFormat = gl.RGBA;
      const srcFormat = gl.RGBA;
      const srcType = gl.UNSIGNED_BYTE;
      //gl.activeTexture(gl.TEXTURE0 + unit);
    	gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                    srcFormat, srcType, image);
    }


    function zeroTexture(gl, texture) {
      const level = 0;
      const internalFormat = gl.RGBA;
      const width = 1;
      const height = 1;
      const border = 0;
      const srcFormat = gl.RGBA;
      const srcType = gl.UNSIGNED_BYTE;
      const blackPixel = new Uint8Array([0, 0, 0, 0]);  // transparent black
    	gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                    width, height, border, srcFormat, srcType,
                    blackPixel);
    }


    // Main drawing routine for the video display
    function drawMediaCanvas(gl, programInfo, buffers, currFrameTexture, prevFrameTexture, deltaTime) {
      gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
      gl.clearDepth(1.0);                 // Clear everything
      gl.enable(gl.DEPTH_TEST);           // Enable depth testing
      gl.depthFunc(gl.LEQUAL);            // Near things obscure far things

      // Clear the canvas before we start drawing on it.
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      const fieldOfView = 45 * Math.PI / 180;   // in radians
      const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
      const zNear = 0.1;
      const zFar = 100.0;
      const projectionMatrix = mat4.create();

      // note: glmatrix.js always has the first argument
      // as the destination to receive the result.
      // mat4.perspective(projectionMatrix,
      //                  fieldOfView,
      //                  aspect,
      //                  zNear,
      //                  zFar);

      // Set the drawing position to the "identity" point, which is
      // the center of the scene.
      const modelViewMatrix = mat4.create();

      // Now move the drawing position a bit to where we want to
      // start drawing the square.
    	mat4.translate(modelViewMatrix,     // destination matrix
                     modelViewMatrix,     // matrix to translate
                     [poi.x, poi.y, -0.0]);

    	mat4.scale(modelViewMatrix,
    						 modelViewMatrix,
    							[zoom, zoom, 1.0]);

    	mat4.translate(modelViewMatrix,     // destination matrix
                     modelViewMatrix,     // matrix to translate
                     [-1 * poi.x, -1 * poi.y, -0.0]);  // amount to translate



      // Tell WebGL how to pull out the positions from the position
      // buffer into the vertexPosition attribute.
      {
        const numComponents = 2;
        const type = gl.FLOAT;
        const normalize = false;
        const stride = 0;
        const offset = 0;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
        gl.vertexAttribPointer(
            programInfo.attribLocations.vertexPosition,
            numComponents,
            type,
            normalize,
            stride,
            offset);
        gl.enableVertexAttribArray(
            programInfo.attribLocations.vertexPosition);
      }


      // Tell WebGL how to pull out the texture coordinates from
      // the texture coordinate buffer into the textureCoord attribute.
      {
        const numComponents = 2;
        const type = gl.FLOAT;
        const normalize = false;
        const stride = 0;
        const offset = 0;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.textureCoord);
        gl.vertexAttribPointer(
            programInfo.attribLocations.textureCoord,
            numComponents,
            type,
            normalize,
            stride,
            offset);
        gl.enableVertexAttribArray(
            programInfo.attribLocations.textureCoord);
      }

      // Tell WebGL which indices to use to index the vertices
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);

      // Tell WebGL to use our program when drawing
      gl.useProgram(programInfo.program);

      // Set the shader uniforms
      gl.uniformMatrix4fv(
          programInfo.uniformLocations.projectionMatrix,
          false,
          projectionMatrix);

    	gl.uniformMatrix4fv(
          programInfo.uniformLocations.modelViewMatrix,
          false,
          modelViewMatrix);

      // Specify the texture to map onto the canvas.
      // We will store the currFrameTexture in texture unit 0
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, currFrameTexture);
      gl.uniform1i(programInfo.uniformLocations.currFrame, 0);

      // We will store the prevFrameTexture in texture unit 1
      gl.activeTexture(gl.TEXTURE0 + 1);
      gl.bindTexture(gl.TEXTURE_2D, prevFrameTexture);
      gl.uniform1i(programInfo.uniformLocations.prevFrame, 1);

      if (noizeOverlay) {
        gl.uniform1f(programInfo.uniformLocations.overlayAlpha, 1.0);
        gl.uniform1f(programInfo.uniformLocations.noizeSeed, Math.random());
      } else {
        gl.uniform1f(programInfo.uniformLocations.overlayAlpha, 0.0);
      }

      { // process the textures into the quad
        const type = gl.UNSIGNED_SHORT;
    		const offset = 0;
        const vertexCount = 6;
        gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
      }
    }


    // Main drawing routine for the spectrogram
    function drawSpectrogramCanvas(gl, programInfo, buffers, prevFrameTexture, currFrameTexture, nextFrameTexture, deltaTime) {
      gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
      gl.clearDepth(1.0);                 // Clear everything
      gl.enable(gl.DEPTH_TEST);           // Enable depth testing
      gl.depthFunc(gl.LEQUAL);            // Near things obscure far things

      // Clear the canvas before we start drawing on it.
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      const fieldOfView = 45 * Math.PI / 180;   // in radians
      const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
      const zNear = 0.1;
      const zFar = 100.0;
      const projectionMatrix = mat4.create();

      // note: glmatrix.js always has the first argument
      // as the destination to receive the result.
      // mat4.perspective(projectionMatrix,
      //                  fieldOfView,
      //                  aspect,
      //                  zNear,
      //                  zFar);

      // Set the drawing position to the "identity" point, which is
      // the center of the scene.
      const modelViewMatrix = mat4.create();

      // Now move the drawing position a bit to where we want to
      // start drawing the square.
    	mat4.translate(modelViewMatrix,     // destination matrix
                     modelViewMatrix,     // matrix to translate
                     [spectTrans, 0.0, 0.0]);

    	//mat4.scale(modelViewMatrix,
    	//					 modelViewMatrix,
    	//						[zoom, zoom, 1.0]);

    	//mat4.translate(modelViewMatrix,     // destination matrix
      //               modelViewMatrix,     // matrix to translate
      //               [-1 * poi.x, -1 * poi.y, -0.0]);  // amount to translate


      // Tell WebGL how to pull out the positions from the position
      // buffer into the vertexPosition attribute.
      {
        const numComponents = 2;
        const type = gl.FLOAT;
        const normalize = false;
        const stride = 0;
        const offset = 0;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
        gl.vertexAttribPointer(
            programInfo.attribLocations.vertexPosition,
            numComponents,
            type,
            normalize,
            stride,
            offset);
        gl.enableVertexAttribArray(
            programInfo.attribLocations.vertexPosition);
      }


      // Tell WebGL how to pull out the texture coordinates from
      // the texture coordinate buffer into the textureCoord attribute.
      {
        const numComponents = 2;
        const type = gl.FLOAT;
        const normalize = false;
        const stride = 0;
        const offset = 0;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.textureCoord);
        gl.vertexAttribPointer(
            programInfo.attribLocations.textureCoord,
            numComponents,
            type,
            normalize,
            stride,
            offset);
        gl.enableVertexAttribArray(
            programInfo.attribLocations.textureCoord);
      }

      // Tell WebGL which indices to use to index the vertices
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);

      // Tell WebGL to use our program when drawing
      gl.useProgram(programInfo.program);

      // Set the shader uniforms
      gl.uniformMatrix4fv(
          programInfo.uniformLocations.projectionMatrix,
          false,
          projectionMatrix);

    	gl.uniformMatrix4fv(
          programInfo.uniformLocations.modelViewMatrix,
          false,
          modelViewMatrix);

      // Specify the texture to map onto the canvas.
      // We will slot the prevFrameTexture into texture unit 0
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, prevFrameTexture);
      gl.uniform1i(programInfo.uniformLocations.prevFrame, 0);

      // We will slot the currFrameTexture into texture unit 1
      gl.activeTexture(gl.TEXTURE0 + 1);
      gl.bindTexture(gl.TEXTURE_2D, currFrameTexture);
      gl.uniform1i(programInfo.uniformLocations.currFrame, 1);

      // We will slot the nextFrameTexture into texture unit 2
      gl.activeTexture(gl.TEXTURE0 + 2);
      gl.bindTexture(gl.TEXTURE_2D, nextFrameTexture);
      gl.uniform1i(programInfo.uniformLocations.nextFrame, 2);


      { // process the textures into the quad
        const type = gl.UNSIGNED_SHORT;
    		const offset = 0;
        const vertexCount = 18;
        gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
      }
    }


    function initShaderProgram(gl, vsSource, fsSource) {
      const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
      const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

      // Create the shader program
      const shaderProgram = gl.createProgram();
      gl.attachShader(shaderProgram, vertexShader);
      gl.attachShader(shaderProgram, fragmentShader);
      gl.linkProgram(shaderProgram);

      // If creating the shader program failed, alert
      if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
        return null;
      }

      return shaderProgram;
    }


    function loadShader(gl, type, source) {
      const shader = gl.createShader(type);

      // Send the source to the shader object
      gl.shaderSource(shader, source);

      // Compile the shader program
      gl.compileShader(shader);

      // See if it compiled successfully
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }

      return shader;
    }


    // Rendering logic for the video timeline scrubber
    function drawScrubberCanvas(canvas, ctx, markers, curtime, totaltime, isHovering, whereHovering, isSeeking, isMuted) {
      const width = canvas.width;
      const height = canvas.height;

      // Creamy white background
      ctx.fillStyle = 'bisque';
      ctx.fillRect(0,0,width,height);

      // red lines at markers
      if (markers !== null) {
        const marker_timeAs = markers.timeA
        const marker_timeBs = markers.timeB
        const colours = markers.colour;
        const marker_times = marker_timeAs.concat(marker_timeBs);

        //function drawMarkerLine(marker_time) {
        //  const markerPos = width * marker_time / totaltime;
        //  ctx.font = '26px serif';
        //  ctx.fillStyle = 'indianred';
        //  ctx.fillRect(markerPos-1, 0, 2, height); }

        function drawMarkerRegion(ta, tb, colour) {
          const markerAPos = width * ta / totaltime;
          var markerBPos;
          if (tb === null) {
            if (!definingRegion) { markerBPos = markerAPos; }
            else { markerBPos = width * curtime / totaltime; }}
          else { markerBPos = width * tb / totaltime; }

          //ctx.font = '26px serif';
          ctx.fillStyle = colour ? colour : defaultColour;
          ctx.fillRect(markerAPos, 0, Math.max(4,markerBPos - markerAPos), height); }

        // old way: draw individual markers
        //marker_times.map(drawMarkerLine);

        // draw the marked regions
        var j; var J = marker_timeAs.length;
        for (j=0; j<J; j++) { drawMarkerRegion(marker_timeAs[j], marker_timeBs[j]); }

        // If hovering over marker readout its time
        if (isHovering) {
          const marker_time = marker_times.closestTo(whereHovering * totaltime);
          if ((Math.abs(marker_time - whereHovering * totaltime) / totaltime) < 0.01) {
            const hoverMarkerPos = width * marker_time / totaltime;
            const marktimeStr = formatTime(marker_time,":");
            const marktimeMet = ctx.measureText(marktimeStr);
            //const markSpareVert = height - marktimeMet.fontBoundingBoxAscent;
            //ctx.fillText(marktimeStr, Math.max(0, Math.min(width-marktimeMet.width, hoverMarkerPos - marktimeMet.width/2)), height - (markSpareVert / 2));
            ctx.fillText(marktimeStr, Math.max(0, Math.min(width-marktimeMet.width, hoverMarkerPos + 6)), height - 27);
          }
        }

      }

      // If video is seeking, then print a message to that effect on the scrubber
      if (isSeeking) {
        const bufferingStr = "buffering ...";
        ctx.font = '44px serif';
        ctx.fillStyle = 'cornflowerblue';
        const bufstrMet = ctx.measureText(bufferingStr);
        ctx.fillText(bufferingStr, (width / 2) - bufstrMet.width / 2, height - 10);
      } else if (isMuted) {
        const bufferingStr = "audio muted ... click on video to unmute";
        ctx.font = '44px serif';
        ctx.fillStyle = 'cornflowerblue';
        const bufstrMet = ctx.measureText(bufferingStr);
        ctx.fillText(bufferingStr, width - (bufstrMet.width + 10) , height - 10);
      }

      // blue line at playhead
      const playheadPos = width * curtime / totaltime;
      ctx.fillStyle = 'cornflowerblue';
      ctx.fillRect(playheadPos-2, 0, 4, height);

      // print out the current time
      const curtimeStr = formatTime(curtime,":");
      ctx.font = '26px serif';
      const curtimeMet = ctx.measureText(curtimeStr);
      //const curSpareVert = height - curtimeMet.fontBoundingBoxAscent;
      ctx.fillText(curtimeStr, Math.max(0, Math.min(width-curtimeMet.width, playheadPos + 6)), height - 4);


    }


    // Main output of the htmlwidget factory is a renderValue function
    return {

      renderValue: function(x) {

        // Comments on the video passed in from R
        var mediaMarkers = x.mediaMarkers;

         // If embedded in Shiny app, listen for changes to markers from Shiny
        if (HTMLWidgets.shinyMode) {
          Shiny.addCustomMessageHandler("updateMarkers",
            function(newMarkers) {
              mediaMarkers = newMarkers
              //Shiny.onInputChange("markers", mediaMarkers);
            })

          Shiny.addCustomMessageHandler("updateDefaultComment",
            function(newComment) {
              defaultComment = newComment;
            })

          Shiny.addCustomMessageHandler("updateDefaultColour",
            function(newColour) {
              defaultColour = newColour;
            })
        };

        // video or just audio?
        const mediaHasVideo = x.mediaHasVideo;

        // The main html for the widget
        const generatedHTML = `
          <div class='grid-container'>
            <div class='grid-item'>
              <canvas id='media_${x.mediaName}' width='1920px' height='1080px' tabindex='0'></canvas>
            </div>
            <div class='grid-item'>
              <canvas id='spectrogram_${x.mediaName}' width='1920px' height='${x.spectrogramHeight}px' tabindex='0'></canvas>
            </div>
            <div class='grid-item'>
              <canvas id='scrubber_${x.mediaName}' width='1920px' height='50px' tabindex='0'></canvas>
            </div>
          </div>
          `;
        el.innerHTML = generatedHTML;

        // Video canvas
        const mediaCanvas = el.querySelector('#media_' + x.mediaName);
        const media_gl = mediaCanvas.getContext('webgl');
        mediaCanvas.style.width = '100%';
        mediaCanvas.style.height = 'auto';

        // spectrogram canvas
        const spectrogramCanvas = el.querySelector('#spectrogram_' + x.mediaName);
        const spectrogram_gl = spectrogramCanvas.getContext('webgl');
        spectrogramCanvas.style.width = '100%';
        spectrogramCanvas.style.height = 'auto';

        // If we don't have a GL context, give up now
        if (!spectrogram_gl) { alert('Unable to initialize WebGL.'); return; }

        // Scrubber canvas
        const scrubberCanvas = el.querySelector('#scrubber_' + x.mediaName);
        const scrubberContext = scrubberCanvas.getContext('2d');
        scrubberCanvas.style.width = '100%';
        scrubberCanvas.style.height = 'auto';

      	// The media file
      	const media = setupMedia(x.mediaURL, x.mediaName);
        media.style.display = 'none';
      	mediaCanvas.appendChild(media);
      	togglePlayback = function() {
      		if (media.paused) {
      			frameByFrame = false;
      			media.play();
      		} else {
      			media.pause();
      		}
      	};

        unmute = function() {
          media.muted = false;
        };

      	showNextFrame = function() {
      		frameByFrame = true;
      		media.play();
      	};

      	nudge = function(amt) { media.currentTime += amt; };

        gotoNextMarker = function() {
          if (mediaMarkers !== null) {
            times = mediaMarkers.timeA;
            candInd = times.indexOfClosestTo(media.currentTime);
            if (0 <= candInd && candInd < times.length && media.currentTime < times[[candInd]]) {
              media.currentTime = times[[candInd]];
            } else if (0 <= candInd && candInd < (times.length - 1)) {
              media.currentTime = times[[candInd+1]];
            }
          }
        }


        gotoPreviousMarker = function() {
          if (mediaMarkers !== null) {
            times = mediaMarkers.timeA;
            candInd = times.indexOfClosestTo(media.currentTime);
            if (media.currentTime > times[[candInd]]) {
              media.currentTime = times[[candInd]];
            } else if (candInd > 0) {
              media.currentTime = times[[candInd-1]];
            }
          }
        }


      	function setupMedia(url,name) {
      	  const media = mediaHasVideo ? document.createElement('video') : document.createElement('audio');
          media.id = name;
          media.crossOrigin = "anonymous";
          var playing = false;
      	  var timeupdate = false;

      	  media.autoplay = true;
      	  media.muted = true;
      	  media.loop = true;

      	  // Waiting for these 2 events ensures
      	  // there is data coming from the media

      	  media.addEventListener('playing', function() {
      	     playing = true;
      	     checkReady();
      	  }, true);

      	  media.addEventListener('timeupdate', function() {
      	     timeupdate = true;
      	     //timeSlider.value = video.currentTime / video.duration;
      	     checkReady();
      	  }, true);

      	  media.src = url;

      	  //video.play();

      	  function checkReady() {
      	    if (playing && timeupdate) {
      	      copyMedia = true; }}

      	  return media;
      	}


        // The spectogram images
        const spectrogramFrames = setupSpectrogram(x.spectrogramDir, x.spectrogramBaseName, x.storyboard);
        spectrogramFrames.forEach(function(img) {
                                    img.style.display = 'none';
      	                            spectrogramCanvas.appendChild(img);
        });



        function setupSpectrogram(specDir, name, storyboard) {
          const prevSpectrogramImage = document.createElement('img');
          const currSpectrogramImage = document.createElement('img');
          const nextSpectrogramImage = document.createElement('img');
          prevSpectrogramImage.id = name + "_sfp";
          currSpectrogramImage.id = name + "_sfc";
          nextSpectrogramImage.id = name + "_sfn";

          const blankFrameFile = x.spectrogramBaseName + "_blank.gif"
          prevSpectrogramImage.src = specDir + "/" + blankFrameFile;
          currSpectrogramImage.src = specDir + "/" + storyboard.image[0];
          nextSpectrogramImage.src = specDir + "/" + storyboard.image[1];

          return([prevSpectrogramImage, currSpectrogramImage, nextSpectrogramImage])
        }


        function updateSpectrogramTextures(gl, prevTexture, currTexture, nextTexture, frameID, storyboard, specDir) {
          const prevSpectrogramImage = spectrogramFrames[0];
          const currSpectrogramImage = spectrogramFrames[1];
          const nextSpectrogramImage = spectrogramFrames[2];

          const blankFrameFile = x.spectrogramBaseName + "_blank.gif"
          if (storyboard.image.length == 1) {
            prevSpectrogramImage.src = specDir + "/" + blankFrameFile;
            currSpectrogramImage.src = specDir + "/" + storyboard.image[0];
            nextSpectrogramImage.src = specDir + "/" + blankFrameFile;
          } else if (storyboard.image.length == 2) {
            if (frameID == 0) {
              prevSpectrogramImage.src = specDir + "/" + blankFrameFile;
              currSpectrogramImage.src = specDir + "/" + storyboard.image[0];
              nextSpectrogramImage.src = specDir + "/" + storyboard.image[1];
            } else {
              prevSpectrogramImage.src = specDir + "/" + storyboard.image[0];
              currSpectrogramImage.src = specDir + "/" + storyboard.image[1];
              nextSpectrogramImage.src = specDir + "/" + blankFrameFile;
            }

          } else if (0 < frameID && frameID < storyboard.image.length-1) {
            prevSpectrogramImage.src = specDir + "/" + storyboard.image[frameID-1];
            currSpectrogramImage.src = specDir + "/" + storyboard.image[frameID];
            nextSpectrogramImage.src = specDir + "/" + storyboard.image[frameID+1];
          } else if (frameID == 0) {
            prevSpectrogramImage.src = specDir + "/" + blankFrameFile;
            currSpectrogramImage.src = specDir + "/" + storyboard.image[0];
            nextSpectrogramImage.src = specDir + "/" + storyboard.image[1];
          } else if (frameID == -1) {
            prevSpectrogramImage.src = specDir + "/" + blankFrameFile;
            currSpectrogramImage.src = specDir + "/" + blankFrameFile;
            nextSpectrogramImage.src = specDir + "/" + storyboard.image[0];
          } else if (frameID == storyboard.image.length-1) {
            prevSpectrogramImage.src = specDir + "/" + storyboard.image[frameID-1];
            currSpectrogramImage.src = specDir + "/" + storyboard.image[frameID];
            nextSpectrogramImage.src = specDir + "/" + blankFrameFile;
          } else if (frameID == storyboard.image.length) {
            prevSpectrogramImage.src = specDir + "/" + storyboard.image[frameID-1];
            currSpectrogramImage.src = specDir + "/" + blankFrameFile;
            nextSpectrogramImage.src = specDir + "/" + blankFrameFile;
          } else {
            prevSpectrogramImage.src = specDir + "/" + blankFrameFile;
            currSpectrogramImage.src = specDir + "/" + blankFrameFile;
            nextSpectrogramImage.src = specDir + "/" + blankFrameFile;
          }

          updateTextureFromImage(gl, prevTexture, prevSpectrogramImage);
          updateTextureFromImage(gl, currTexture, currSpectrogramImage);
          updateTextureFromImage(gl, nextTexture, nextSpectrogramImage);
        }


        function spectrogramFrameContainingTime(t, storyboard) {
          if (t < storyboard.start[0])
            return(-1);

          if (t > storyboard.end[storyboard.end.length -1])
            return(storyboard.ID.length);

          var idx = 0;
          while(t > storyboard.end[idx])
            idx++;

          return(idx);
        };


        function fractionThroughSpectrogramFrame(t, storyboard) {
          idx = spectrogramFrameContainingTime(t, storyboard);

          if (idx < 0)
            return(0.0);

          if (idx >= storyboard.ID.length)
            return(1.0);

          const frameDur = storyboard.end[idx] - storyboard.start[idx];
          return ((t - storyboard.start[idx]) / frameDur);
        };


      	// Event handling
      	mousedownMediaCanvas = function(evt) {
      		unmute();
      		old_poi = getMouseNDC(mediaCanvas,evt);
      		panClickPoint = getMouseNDC(mediaCanvas,evt);
      		panning = true;
      		//console.log("Starting pan from " + panClickPoint.x + ", " + panClickPoint.y);
      	};

      	mouseupMediaCanvas = function(evt) {
      		panning = false;
      	};

      	mousemoveMediaCanvas = function(evt) {
      		if (panning) {
      			evt.preventDefault();
      			currentMouse = getMouseNDC(mediaCanvas,evt);
      			poi.x = old_poi.x - (currentMouse.x - panClickPoint.x)/zoom;
      			poi.y = old_poi.y - (currentMouse.y - panClickPoint.y)/zoom;
      		}
      	};

      	keydownEitherCanvas = function(evt) {
          unmute();

          if (evt.key == "0") { resetZoomAndPan(); }
       		else if (evt.key == " ") { evt.preventDefault(); togglePlayback(); }
      		else if (evt.key == "ArrowRight") {
      		  if (evt.shiftKey) { gotoNextMarker(); }
      		  else { if (media.paused) showNextFrame(); else nudge(1.0); }
      		}
      		else if (evt.key == "ArrowLeft") {
      		  if (evt.shiftKey) { gotoPreviousMarker(); }
      		  else { if (media.paused) nudge(-1/30); else nudge(-1.0); }
      		}
      		else if (evt.key == "F13") { evt.preventDefault(); capture = true; }
      		else if (evt.key == "d") { toggleSubtractPrevFrame();  }
      		else if (evt.key == "Enter") {
      		  evt.preventDefault();
      		  if (definingRegion) {
      		    const ind = mediaMarkers.timeA.indexOfClosestTo(definingRegionStartTime);
      		    mediaMarkers.timeB[ind] = media.currentTime;
      		    definingRegion = false;
      		    definingRegionStartTime = null;
      		  } else {
      		    const shiftPressed = evt.getModifierState("Shift");
      		    if (shiftPressed) {
      		      mediaMarkers = addMarker(mediaMarkers, media.currentTime, null, "REGION", defaultColour, defaultComment);
                definingRegion = true;
                definingRegionStartTime = media.currentTime;
      		    } else {
      		      mediaMarkers = addMarker(mediaMarkers, media.currentTime, media.currentTime, "POINT", defaultColour, defaultComment);
      		    }
      		  }

      		  // If embedded in Shiny app, let it know about new markers
            if (HTMLWidgets.shinyMode) {
              console.log(mediaMarkers);
              Shiny.setInputValue("spectR.markers", mediaMarkers);
            }
      		}
      	};

      	wheelMediaCanvas = function(evt) {
      		evt.preventDefault();
      		poi = getMouseNDC(mediaCanvas,evt);
      		zoom *= (1 - Math.max(-0.5,Math.min(0.5, (evt.deltaY / 250))));
      		zoom = Math.max(zoom, 1.0);
      	};

        mousedownScrubberCanvas = function(evt) {
      		scrubClickPoint = getMouseTextureCoord(scrubberCanvas,evt);
          var newtime = media.duration * scrubClickPoint.x;
          console.log("Scrubbing to " + newtime);
          media.currentTime = newtime;
      	};

      	//mouseupScrubberCanvas = function(evt) {};
        mouseenterScrubberCanvas = function(evt) {
          hoveringOverScrubber = true;
        }

        mouseleaveScrubberCanvas = function(evt) {
          hoveringOverScrubber = false;
        }

      	mousemoveScrubberCanvas = function(evt) {
      		hoverPoint = getMouseTextureCoord(scrubberCanvas,evt).x;
      	};

      	mediaCanvas.addEventListener('keydown', keydownEitherCanvas);
      	mediaCanvas.addEventListener('wheel', wheelMediaCanvas);
      	mediaCanvas.addEventListener('mousedown', mousedownMediaCanvas);
      	mediaCanvas.addEventListener('mouseup', mouseupMediaCanvas);
      	mediaCanvas.addEventListener('mousemove', mousemoveMediaCanvas);

        scrubberCanvas.addEventListener('keydown', keydownEitherCanvas);
      	scrubberCanvas.addEventListener('mousedown', mousedownScrubberCanvas);
      	//scrubberCanvas.addEventListener('mouseup', mouseupScrubberCanvas);
      	scrubberCanvas.addEventListener('mousemove', mousemoveScrubberCanvas);
      	scrubberCanvas.addEventListener('mouseenter', mouseenterScrubberCanvas);
      	scrubberCanvas.addEventListener('mouseleave', mouseleaveScrubberCanvas);

        //document.addEventListener('keypress',tabPressedGlobal);

        // Vertex shader program for video (if present)
        const media_vsSource = `
          attribute vec4 aVertexPosition;
      		attribute vec2 aTextureCoord;

      		uniform mat4 uModelViewMatrix;
          uniform mat4 uProjectionMatrix;

      		varying highp vec2 vTextureCoord;

          void main(void) {
            gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
      			vTextureCoord = aTextureCoord;
          }
        `;

        // Fragment shader program for video (if present)
        const media_fsSource = `
          varying highp vec2 vTextureCoord;
      		uniform sampler2D uCurrFrame;
      		uniform sampler2D uPrevFrame;
          uniform lowp float uOverlayAlpha;
          uniform lowp float uNoizeSeed;

      		lowp float rand(lowp vec2 co) {
            return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
          }

      		void main() {
      			highp vec4 currTexelColor = texture2D(uCurrFrame, vTextureCoord);
      			highp vec4 prevTexelColor = texture2D(uPrevFrame, vTextureCoord);

      			if (uOverlayAlpha > 0.5) {
      			  highp float noize = rand(vTextureCoord * uNoizeSeed) * uOverlayAlpha;
              gl_FragColor = vec4(noize,noize,noize,1.0);
      			} else {
      			   gl_FragColor = vec4(
      				  abs(currTexelColor.r - prevTexelColor.r),
      				  abs(currTexelColor.g - prevTexelColor.g),
      				  abs(currTexelColor.b - prevTexelColor.b),
      				  1.0);
      			}
          }
        `;


        // Vertex shader program for spectrogram
        const spectrogram_vsSource = `
          attribute vec4 aVertexPosition;
      		attribute vec2 aTextureCoord;

      		uniform mat4 uModelViewMatrix;
          uniform mat4 uProjectionMatrix;

      		varying highp vec2 vTextureCoord;

          void main(void) {
            gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
      			vTextureCoord = aTextureCoord;
          }
        `;

         // Fragment shader program for spectrogram
        const spectrogram_fsSource = `
          varying highp vec2 vTextureCoord;
      		uniform sampler2D uPrevFrame;
      		uniform sampler2D uCurrFrame;
      		uniform sampler2D uNextFrame;

      		void main() {

            highp vec2 vRelativeTextureCoord = vTextureCoord;
            highp vec4 texelColor = texture2D(uCurrFrame,vTextureCoord);

      		  if (vTextureCoord.x < 0.0)  {
      		    vRelativeTextureCoord = vec2(vTextureCoord.x + 1.0, vTextureCoord.y);
      		    texelColor = texture2D(uPrevFrame, vRelativeTextureCoord);
      		  } else if (vTextureCoord.x > 1.0) {
      		    vRelativeTextureCoord = vec2(vTextureCoord.x - 1.0, vTextureCoord.y);
      		    texelColor = texture2D(uNextFrame, vRelativeTextureCoord);
      		  }

      			gl_FragColor = vec4(texelColor.rgb,1.0);

          }
        `;

        // Initialize a shader program; this is where all the lighting
        // for the vertices and so forth is established.
        const media_shaderProgram = initShaderProgram(media_gl, media_vsSource, media_fsSource);
        const spectrogram_shaderProgram = initShaderProgram(spectrogram_gl, spectrogram_vsSource, spectrogram_fsSource);

        // Collect all the info needed to use the shader program.
        // Look up which attribute our shader program is using
        // for aVertexPosition and look up uniform locations.
        const media_programInfo = {
          program: media_shaderProgram,
          attribLocations: {
            vertexPosition: media_gl.getAttribLocation(media_shaderProgram, 'aVertexPosition'),
      			textureCoord: media_gl.getAttribLocation(media_shaderProgram, 'aTextureCoord'),
          },
          uniformLocations: {
            projectionMatrix: media_gl.getUniformLocation(media_shaderProgram, 'uProjectionMatrix'),
            modelViewMatrix: media_gl.getUniformLocation(media_shaderProgram, 'uModelViewMatrix'),
      			currFrame: media_gl.getUniformLocation(media_shaderProgram, 'uCurrFrame'),
      			prevFrame: media_gl.getUniformLocation(media_shaderProgram, 'uPrevFrame'),
      			overlayAlpha: media_gl.getUniformLocation(media_shaderProgram, 'uOverlayAlpha'),
      			noizeSeed: media_gl.getUniformLocation(media_shaderProgram, 'uNoizeSeed'),
          },
        };


      	const spectrogram_programInfo = {
          program: spectrogram_shaderProgram,
          attribLocations: {
            vertexPosition: spectrogram_gl.getAttribLocation(spectrogram_shaderProgram, 'aVertexPosition'),
      			textureCoord: spectrogram_gl.getAttribLocation(spectrogram_shaderProgram, 'aTextureCoord'),
          },
          uniformLocations: {
            projectionMatrix: spectrogram_gl.getUniformLocation(spectrogram_shaderProgram, 'uProjectionMatrix'),
            modelViewMatrix: spectrogram_gl.getUniformLocation(spectrogram_shaderProgram, 'uModelViewMatrix'),
      			prevFrame: spectrogram_gl.getUniformLocation(spectrogram_shaderProgram, 'uPrevFrame'),
      			currFrame: spectrogram_gl.getUniformLocation(spectrogram_shaderProgram, 'uCurrFrame'),
      			nextFrame: spectrogram_gl.getUniformLocation(spectrogram_shaderProgram, 'uCurrFrame'),
          },
        };


      	const media_buffers = initMediaCanvasBuffers(media_gl);
        const media_currFrameTexture = initTexture(media_gl);
      	const media_prevFrameTexture = initTexture(media_gl);
      	zeroTexture(media_gl, media_prevFrameTexture);

        const spectrogram_buffers = initSpectrogramCanvasBuffers(spectrogram_gl);
        const spectrogram_currFrameTexture = initTexture(spectrogram_gl);
      	const spectrogram_prevFrameTexture = initTexture(spectrogram_gl);
      	const spectrogram_nextFrameTexture = initTexture(spectrogram_gl);

      	toggleSubtractPrevFrame = function() {
      		if (subtractPrevFrame) {
      			zeroTexture(media_gl, media_prevFrameTexture);
      			subtractPrevFrame = false;
      		} else {
      			subtractPrevFrame = true;
      		}
      	}


      	// time of last animation frame
        var then = 0;

        // Main rendering loop
        function render(now) {
          now *= 0.001;  // convert to seconds
          const deltaTime = now - then;
          then = now;

          // Read in the next video frame
      		if (copyMedia && !media.seeking) { noizeOverlay = false; updateTextureFromVideo(media_gl, media_currFrameTexture, media); }
      		else { noizeOverlay = true; }

          // Figure out which spectrogram frames are needed
          var spfid = spectrogramFrameContainingTime(media.currentTime, x.storyboard);
          if (spfid != currSpectrogramFrameID) {
            currSpectrogramFrameID = spfid
            updateSpectrogramTextures(spectrogram_gl,
                                      spectrogram_prevFrameTexture,
                                      spectrogram_currFrameTexture,
                                      spectrogram_nextFrameTexture,
                                      spfid,
                                      x.storyboard,
                                      x.spectrogramDir);
          }


          spectTrans = -1.0 * fractionThroughSpectrogramFrame(media.currentTime, x.storyboard);

      		// draw the scene
          drawMediaCanvas(media_gl, media_programInfo, media_buffers, media_currFrameTexture, media_prevFrameTexture, deltaTime);
          drawSpectrogramCanvas(spectrogram_gl, spectrogram_programInfo, spectrogram_buffers,
                                spectrogram_prevFrameTexture, spectrogram_currFrameTexture, spectrogram_nextFrameTexture,
                                deltaTime);
          drawScrubberCanvas( scrubberCanvas, scrubberContext, mediaMarkers, media.currentTime, media.duration,
                        hoveringOverScrubber, hoverPoint, (!copyMedia) || media.seeking, media.muted);

          if (capture) {
            capture = false;
            //var data = canvas.toDataURL("image/png", 1);
            //document.getElementById('snapshot').setAttribute('src', data);
            spectrogramCanvas.toBlob(function(blob) {
              saveAs(blob, extractMainIdentifier(x.mediaURL) + "_spectrogram_" + formatTime(media.currentTime) + ".png");
            });
          }

          // and update the previous frame texture
      		if (subtractPrevFrame && copyMedia && !media.seeking)
      			 { updateTextureFromVideo(media_gl, media_prevFrameTexture, media); }

      		// if advancing frame by frame we need to re-pause the video
      		if (frameByFrame) { media.pause(); }

      		// Temporal recursion
          requestAnimationFrame(render);
        };

      	// Start the main rendering loop
      	requestAnimationFrame(render);
	    },


      resize: function(width, height) {

        // TODO: code to re-render the widget with a new size

      }

    };
  }
});
