import React from 'react';

export default class AppErrorBoundary extends React.Component {
  state={error:null};
  static getDerivedStateFromError(error){return{error};}
  componentDidCatch(error,info){console.error('Application view failed:',error,info.componentStack);}
  render(){
    if(!this.state.error)return this.props.children;
    return <section className="content-card glass" role="alert" style={{margin:'2rem',padding:'2rem'}}><h2>This view could not be opened</h2><p>Your saved cloud data is preserved. Retry the view; if browser storage is blocked, allow storage for this site.</p><p>{this.state.error.message}</p><button type="button" className="btn-primary" onClick={()=>this.setState({error:null})}>Retry view</button></section>;
  }
}
