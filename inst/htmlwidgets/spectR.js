HTMLWidgets.widget({

  name: 'spectR',

  type: 'output',

  factory: function(el, width, height) {

    ///////////////// Polyfills //////////////////
    // https://github.com/uxitten/polyfill/blob/master/string.polyfill.js
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/padStart
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


    //////// ybot ////////
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

    addMarker = function(markers, t, commentStr) {

      if (markers !== null) {
        var times = markers.time;
        var comments = markers.comment;
        times.push(t);
        comments.push(commentStr);
        return {
                time: times,
                comment: comments
             };
      } else {
        return {
          time: [t],
          comment: [commentStr]
        };
      }

    };

    // TODO: define shared variables for this instance
    var copyAudio = false;
    var copyImage = false;
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


    function initBuffers(gl) {

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
      // will work regardless of the dimensions of the image.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

      return texture;
    }

    function updateTexture(gl, texture, img) {
      const level = 0;
      const internalFormat = gl.RGBA;
      const srcFormat = gl.RGBA;
      const srcType = gl.UNSIGNED_BYTE;
      //gl.activeTexture(gl.TEXTURE0 + unit);
    	gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                    srcFormat, srcType, img);
    }

    function zeroTexture(gl, texture)
    {
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

    function drawScene(gl, programInfo, buffers, texture, deltaTime) {
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
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(programInfo.uniformLocations.spectrogram, 0);


      { // process the textures into the quad
        const type = gl.UNSIGNED_SHORT;
    		const offset = 0;
        const vertexCount = 6;
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


    // Rendering logic for the audio timeline scrubber
    function drawScrubber(canvas, ctx, markers, curtime, totaltime, isHovering, whereHovering, isSeeking, isMuted) {
      const width = canvas.width;
      const height = canvas.height;

      // Creamy white background
      ctx.fillStyle = 'bisque';
      ctx.fillRect(0,0,width,height);

      // red lines at markers
      if (markers !== null) {
        const marker_times = markers.time
        function drawMarkerLine(marker_time) {
          const markerPos = width * marker_time / totaltime;
          ctx.font = '26px serif';
          ctx.fillStyle = 'indianred';
          ctx.fillRect(markerPos-3, 0, 6, height);
        }
        marker_times.map(drawMarkerLine);

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

      // If audio is seeking, then print a message to that effect on the scrubber
      if (isSeeking) {
        const bufferingStr = "buffering ...";
        ctx.font = '44px serif';
        ctx.fillStyle = 'cornflowerblue';
        const bufstrMet = ctx.measureText(bufferingStr);
        ctx.fillText(bufferingStr, (width / 2) - bufstrMet.width / 2, height - 10);
      } else if (isMuted) {
        const bufferingStr = "audio muted ... click on spectrogram to unmute";
        ctx.font = '44px serif';
        ctx.fillStyle = 'cornflowerblue';
        const bufstrMet = ctx.measureText(bufferingStr);
        ctx.fillText(bufferingStr, width - (bufstrMet.width + 10) , height - 10);
      }

      // blue line at playhead
      const playheadPos = width * curtime / totaltime;
      ctx.fillStyle = 'cornflowerblue';
      ctx.fillRect(playheadPos-3, 0, 6, height);

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

        // Comments on the audio passed in from R
        var audioMarkers = x.audioMarkers;

        // The main html for the widget
        const generatedHTML = `
          <div class='grid-container'>
            <div class='grid-item'>
              <canvas id='glcanvas' width='1920px' height='1080px' tabindex='0'></canvas>
            </div>
            <div class='grid-item'>
              <canvas id='scrubber_${x.audioName}' width='1920px' height='50px' tabindex='0'></canvas>
            </div>
          </div>
          `;
        el.innerHTML = generatedHTML;

        // Spectrogram canvas
        const spectroCanvas = el.querySelector('#glcanvas');
        const gl = spectroCanvas.getContext('webgl');
        spectroCanvas.style.width = '100%';
        spectroCanvas.style.height = 'auto';

        // If we don't have a GL context, give up now
        if (!gl) { alert('Unable to initialize WebGL.'); return; }

        ///////// Scrubber canvas ////////
        const scrubberCanvas = el.querySelector('#scrubber_' + x.audioName);
        const scrubberContext = scrubberCanvas.getContext('2d');
        scrubberCanvas.style.width = '100%';
        scrubberCanvas.style.height = 'auto';

        ///////// The audio /////////
        const audio = setupAudio(x.mainDir, x.audioFile, x.audioName);
        audio.style.display = 'none';
        spectroCanvas.appendChild(audio);

        function setupAudio(dirURL,fname,el_name) {
      	  const audio = document.createElement('audio');
          audio.id = el_name;
          audio.crossOrigin = "anonymous";
          var playing = false;
      	  var timeupdate = false;

      	  audio.autoplay = false;
      	  audio.muted = false;
      	  audio.loop = true;

          // Waiting for these 2 events ensures
      	  // there is data in the audio
      	  audio.addEventListener('playing', function() {
      	     playing = true;
      	     checkReady();
      	  }, true);

      	  audio.addEventListener('timeupdate', function() {
      	     timeupdate = true;
      	     checkReady();
      	  }, true);

      	  audio.src = dirURL + "/" + fname;

      	  function checkReady() {
      	    if (playing && timeupdate) {
      	      copyAudio = true; }}

      	  return audio;
      	}

        toggleAudioPlayback = function() {
      		if (audio.paused) {
      			frameByFrame = false;
      			audio.play();
      		} else {
      			audio.pause();
      		}
      	};

        unmute = function() {
          audio.muted = false;
        };

      	showNextFrame = function() {
      		frameByFrame = true;
      		audio.play();
      	};

      	nudge = function(amt) { audio.currentTime += amt; };

      	/////////// The spectrogram image //////////
      	const spectroImage = setupImage(x.mainDir, x.spectrogramFile, x.audioName);
        spectroImage.onload = function() {  updateTexture(gl, spectroTexture, spectroImage) }
//        video.style.display = 'none';
//      	videoCanvas.appendChild(video);
//      	togglePlayback = function() {
//      		if (video.paused) {
//      			frameByFrame = false;
//      			video.play();
//      		} else {
//      			video.pause();
//      		}
//      	};

      	function setupImage(dirURL, imgFilename, audioName) {
      	  const image = document.createElement('img');
          image.id = audioName + "_spectrogram";
          image.crossOrigin = "anonymous";
          image.style.display = 'none';
          spectroCanvas.appendChild(image);
          image.src = dirURL + "/" + imgFilename;
          return image;
      	}

      	// Event handling
      	mousedownSpectroCanvas = function(evt) {
      		unmute();
      		old_poi = getMouseNDC(spectroCanvas,evt);
      		panClickPoint = getMouseNDC(spectroCanvas,evt);
      		panning = true;
      		//console.log("Starting pan from " + panClickPoint.x + ", " + panClickPoint.y);
      	};

      	mouseupSpectroCanvas = function(evt) {
      		panning = false;
      	};

      	mousemoveSpectroCanvas = function(evt) {
      		if (panning) {
      			evt.preventDefault();
      			currentMouse = getMouseNDC(spectroCanvas,evt);
      			poi.x = old_poi.x - (currentMouse.x - panClickPoint.x)/zoom;
      			poi.y = old_poi.y - (currentMouse.y - panClickPoint.y)/zoom;
      		}
      	};

      	keydownSpectroCanvas = function(evt) {
          unmute();
          if (evt.key == "0") { resetZoomAndPan(); }
       		else if (evt.key == " ") { evt.preventDefault(); toggleAudioPlayback(); }
      		else if (evt.key == "ArrowRight") { if (audio.paused) showNextFrame(); else nudge(1.0); }
      		else if (evt.key == "ArrowLeft") { if (audio.paused) nudge(-1/30); else nudge(-1.0); }
      		else if (evt.key == "F13") { capture = true; }
      		else if (evt.key == "d") { evt.preventDefault(); toggleSubtractPrevFrame();  }
      		else if (evt.key == "Enter") {
      		  audioMarkers = addMarker(audioMarkers, audio.currentTime, "no comment");
      		  // If embedded in Shiny app, let it know about new markers
            if (HTMLWidgets.shinyMode) {
              Shiny.onInputChange("markers", audioMarkers);
            }
      		}
      	};

      	wheelSpectroCanvas = function(evt) {
      		evt.preventDefault();
      		//console.log(evt);
      		poi = getMouseNDC(spectroCanvas,evt);
      		zoom *= (1 - Math.max(-0.5,Math.min(0.5, (evt.deltaY / 250))));
      		zoom = Math.max(zoom, 1.0);
      	};

        mousedownScrubberCanvas = function(evt) {
      		scrubClickPoint = getMouseTextureCoord(scrubberCanvas,evt);
          var newtime = audio.duration * scrubClickPoint.x;
          console.log("Scrubbing to " + newtime);
          audio.currentTime = newtime;
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

      	spectroCanvas.addEventListener('keydown', keydownSpectroCanvas);
      	spectroCanvas.addEventListener('wheel', wheelSpectroCanvas);
      	spectroCanvas.addEventListener('mousedown', mousedownSpectroCanvas);
      	spectroCanvas.addEventListener('mouseup', mouseupSpectroCanvas);
      	spectroCanvas.addEventListener('mousemove', mousemoveSpectroCanvas);

      	scrubberCanvas.addEventListener('mousedown', mousedownScrubberCanvas);
      	//scrubberCanvas.addEventListener('mouseup', mouseupScrubberCanvas);
      	scrubberCanvas.addEventListener('mousemove', mousemoveScrubberCanvas);
      	scrubberCanvas.addEventListener('mouseenter', mouseenterScrubberCanvas);
      	scrubberCanvas.addEventListener('mouseleave', mouseleaveScrubberCanvas);

        // Vertex shader program
        const vsSource = `
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

        // Fragment shader program
        const fsSource = `
          varying highp vec2 vTextureCoord;
      		uniform sampler2D uSpectrogram;

      		void main() {
      	    highp vec4 texelColor = texture2D(uSpectrogram, vTextureCoord);
    			  gl_FragColor = vec4(texelColor.rgb,1.0);
          }
        `;

        // Initialize a shader program; this is where all the lighting
        // for the vertices and so forth is established.
        const shaderProgram = initShaderProgram(gl, vsSource, fsSource);

        // Collect all the info needed to use the shader program.
        // Look up which attribute our shader program is using
        // for aVertexPosition and look up uniform locations.
        const programInfo = {
          program: shaderProgram,
          attribLocations: {
            vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
      			textureCoord: gl.getAttribLocation(shaderProgram, 'aTextureCoord'),
          },
          uniformLocations: {
            projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
            modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
      			spectrogram: gl.getUniformLocation(shaderProgram, 'uSpectrogram'),
          },
        };

      	const buffers = initBuffers(gl);
        const spectroTexture = initTexture(gl);
        updateTexture(gl, spectroTexture, spectroImage);

      	// time of last animation frame
        var then = 0;

        // Main rendering loop
        function render(now) {
          now *= 0.001;  // convert to seconds
          const deltaTime = now - then;
          then = now;

          // Read in the next video frame
      		//if (copyAudio && !audio.seeking) { updateTexture(gl, currFrameTexture, video); }

      		// draw the scene
          drawScene(gl, programInfo, buffers, spectroTexture, deltaTime);
          drawScrubber( scrubberCanvas, scrubberContext, audioMarkers, audio.currentTime, audio.duration,
                        hoveringOverScrubber, hoverPoint, (!copyAudio) || audio.seeking, audio.muted);

          if (capture) {
            capture = false;
            //var data = canvas.toDataURL("image/png", 1);
            //document.getElementById('snapshot').setAttribute('src', data);
            spectroCanvas.toBlob(function(blob) {
              saveAs(blob, x.audioName + "_" + formatTime(audio.currentTime) + ".png");
            });
          }

          // if advancing frame by frame we need to re-pause the video
      		if (frameByFrame) { audio.pause(); }

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
