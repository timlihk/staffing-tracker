import { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button, Paper, Container } from '@mui/material';
import { ErrorOutline } from '@mui/icons-material';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Intentional console.error for error tracking - should be replaced with error reporting service in production
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });

    // Check if this is a chunk load error (happens after new deployment)
    // These errors occur when the browser has an old index.html cached but
    // the JS chunks referenced in it no longer exist on the server
    const isChunkLoadError = 
      error.message?.includes('Failed to fetch dynamically imported module') ||
      error.message?.includes('Loading chunk') ||
      error.message?.includes('Loading CSS chunk') ||
      /importScripts failed for|Failed to load module script|Unexpected token/.test(error.message);

    if (isChunkLoadError) {
      // eslint-disable-next-line no-console
      console.log('Detected chunk load error, reloading page to get fresh files...');
      // Force a hard reload to fetch the latest index.html with updated chunk references
      window.location.reload();
    }
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    window.location.href = '/';
  };

  private isChunkLoadError(error: Error | null): boolean {
    if (!error) return false;
    return (
      error.message?.includes('Failed to fetch dynamically imported module') ||
      error.message?.includes('Loading chunk') ||
      error.message?.includes('Loading CSS chunk') ||
      /importScripts failed for|Failed to load module script/.test(error.message)
    );
  }

  private handleReload = () => {
    // Force a hard reload bypassing cache
    window.location.href = window.location.href;
  };

  public render() {
    if (this.state.hasError) {
      const isChunkError = this.isChunkLoadError(this.state.error);
      
      return (
        <Container maxWidth="md">
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            minHeight="100vh"
            textAlign="center"
          >
            <Paper
              elevation={3}
              sx={{
                p: 4,
                width: '100%',
                maxWidth: 600,
              }}
            >
              <ErrorOutline
                sx={{
                  fontSize: 80,
                  color: isChunkError ? 'warning.main' : 'error.main',
                  mb: 2,
                }}
              />
              <Typography variant="h4" gutterBottom fontWeight={700}>
                {isChunkError ? 'App Updated' : 'Oops! Something went wrong'}
              </Typography>
              <Typography color="text.secondary" paragraph>
                {isChunkError 
                  ? 'The application has been updated. Please reload the page to get the latest version.'
                  : "We're sorry for the inconvenience. An unexpected error has occurred."}
              </Typography>

              {!isChunkError && this.state.error && (
                <Box
                  sx={{
                    mt: 3,
                    p: 2,
                    bgcolor: 'grey.100',
                    borderRadius: 1,
                    textAlign: 'left',
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    overflow: 'auto',
                    maxHeight: 200,
                  }}
                >
                  <Typography variant="body2" color="error" sx={{ fontFamily: 'monospace' }}>
                    {this.state.error.toString()}
                  </Typography>
                  {this.state.errorInfo && (
                    <Typography
                      variant="caption"
                      component="pre"
                      sx={{
                        mt: 1,
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {this.state.errorInfo.componentStack}
                    </Typography>
                  )}
                </Box>
              )}

              <Box mt={4} display="flex" gap={2} justifyContent="center">
                {!isChunkError && (
                  <Button variant="outlined" onClick={this.handleReset} size="large">
                    Return to Home
                  </Button>
                )}
                <Button 
                  variant="contained" 
                  onClick={this.handleReload} 
                  size="large"
                  color={isChunkError ? 'primary' : 'primary'}
                >
                  {isChunkError ? 'Reload to Update' : 'Reload Page'}
                </Button>
              </Box>
            </Paper>
          </Box>
        </Container>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
