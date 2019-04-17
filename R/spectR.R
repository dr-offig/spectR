#' <Add Title>
#'
#' <Add Description>
#'
#' @import htmlwidgets
#'
#' @export
spectR <- function(audioName, mainDir, audioFile, spectrogramFile, audioMarkers = NULL, width = NULL, height = NULL, elementId = NULL) {

  # create audiorecord
  #ar <- audiorecord$new(filenames=list(audioURL))

  # forward options using x
  x = list(
    audioName = audioName,
    mainDir = mainDir,
    audioFile = audioFile,
    spectrogramFile = spectrogramFile,
    audioMarkers = audioMarkers
  )

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
spectROutput <- function(outputId, width = '100%', height = '575px'){
  htmlwidgets::shinyWidgetOutput(outputId, 'spectR', width, height, package = 'spectR')
}

#' @rdname spectR-shiny
#' @export
renderSpectR <- function(expr, env = parent.frame(), quoted = FALSE) {
  if (!quoted) { expr <- substitute(expr) } # force quoted
  htmlwidgets::shinyRenderWidget(expr, spectROutput, env, quoted = TRUE)
}
