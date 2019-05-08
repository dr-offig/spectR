#' <Add Title>
#'
#' <Add Description>
#'
#' @import htmlwidgets
#'
#' @export
spectR <- function(mediaURL, mediaName, mediaHasVideo,
                   spectrogramDir, spectrogramBaseName, spectrogramHeight,
                   mediaMarkers=NULL, width = NULL, height = NULL, elementId = NULL)
{
  spectrogramStoryboardPath <- paste0(spectrogramDir,"/", spectrogramBaseName, "_storyboard.csv")
  storyboard <- read.csv(spectrogramStoryboardPath, header = TRUE, stringsAsFactors = FALSE )
  str(storyboard)

  # forward options using x
  x = list(
    mediaURL = mediaURL,
    mediaName = mediaName,
    mediaHasVideo = mediaHasVideo,
    spectrogramDir = spectrogramDir,
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
