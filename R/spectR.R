#' SpectR
#'
#' Live Spectrogram Viewing
#'
#' @import htmlwidgets
#'
#' @export
spectR <- function(embeddingURL, embeddingMountPoint, mediaRelativePath, mediaName, mediaHasVideo,
                   spectRelativeDir, spectrogramBaseName, spectrogramHeight,
                   mediaMarkers=NULL, width = NULL, height = NULL, elementId = NULL)
{

  # full paths depend on the embedding
  mediaURL <- paste(sep="/", embeddingURL, mediaRelativePath)
  mediaPath <- paste(sep="/", embeddingMountPoint, mediaRelativePath)
  spectrogramURL <- paste(sep="/", embeddingURL, spectRelativeDir)
  spectrogramDir <- paste(sep="/", embeddingMountPoint, spectRelativeDir)

  # check if spectrogram exists, else create it
  if (!dir.exists(spectrogramDir))
    dir.create(spectrogramDir)

  spectrogramStoryboardPath <- paste0(spectrogramDir,"/", spectrogramBaseName, "_storyboard.csv")
  if (file.exists(spectrogramStoryboardPath))
    storyboard <- read.csv(spectrogramStoryboardPath, header = TRUE, stringsAsFactors = FALSE )
  else {
    storyboard <- data.frame("ID"=integer(0),"image"=character(0),"start"=numeric(0),"end"=numeric(0))
    #blankFrameImg <- image_graph(width=width, height=spectrogramHeight, bg="black")
    #frame()
    #image_write(blankFrameImg, path=paste0(spectrogramDir,"/",spectrogramBaseName,"_blank.gif"), format="gif")
    renderSpectrogram(mediaPath=mediaPath, spectrogramDir=spectrogramDir)
  }

  # forward options using x
  x = list(
    embeddingURL = embeddingURL,
    embeddingMountPoint = embeddingMountPoint,
    mediaURL = mediaURL,
    mediaPath = mediaPath,
    mediaName = mediaName,
    mediaHasVideo = mediaHasVideo,
    spectrogramDir = spectrogramDir,
    spectrogramURL = spectrogramURL,
    spectrogramBaseName = spectrogramBaseName,
    spectrogramHeight = spectrogramHeight,
    storyboard = storyboard,
    mediaMarkers = mediaMarkers
  )

  # put in some meta tags
  #deps <- list(htmltools::htmlDependency(name="responsive",version=1,src="/",
  #                                    head="<meta name='viewport' content='width=device-width, initial-scale=1.0'>"))

  # create widget
  htmlwidgets::createWidget(
    name = 'spectR',
    x,
    width = width,
    height = height,
    package = 'spectR',
    elementId = elementId
  )
}

#' Shiny bindings for spectR
#'
#' Output and render functions for using spectR within Shiny
#' applications and interactive Rmd documents.
#'
#' @param outputId output variable to read from
#' @param width,height Must be a valid CSS unit (like \code{'100\%'},
#'   \code{'400px'}, \code{'auto'}) or a number, which will be coerced to a
#'   string and have \code{'px'} appended.
#' @param expr An expression that generates a spectR
#' @param env The environment in which to evaluate \code{expr}.
#' @param quoted Is \code{expr} a quoted expression (with \code{quote()})? This
#'   is useful if you want to save an expression in a variable.
#'
#' @name spectR-shiny
#'
#' @export
spectROutput <- function(outputId, width = '100%', height = 'auto'){
  htmlwidgets::shinyWidgetOutput(outputId, 'spectR', width, height, package = 'spectR')
}

#' @rdname spectR-shiny
#' @export
renderspectR <- function(expr, env = parent.frame(), quoted = FALSE) {
  if (!quoted) { expr <- substitute(expr) } # force quoted
  htmlwidgets::shinyRenderWidget(expr, spectROutput, env, quoted = TRUE)
}

# Utility function
renderSpectrogram <- function(mediaPath, spectrogramDir, samplerate=48000,
                              fftSize=1024, fftHop=512,
                              frameWidth=1920, frameHeight=as.integer(round(fftSize/2)),
                              channel=1, contrast=0.25) {
  ar <- listenR::Audiorecord$new(mediaPath, samplerate=samplerate)
  ar$spectrogramMovie(filepath=spectrogramDir, fftSize=fftSize,fftHop=fftHop,frameWidth=frameWidth,frameHeight=frameHeight,channel=channel,contrast=contrast)
}




